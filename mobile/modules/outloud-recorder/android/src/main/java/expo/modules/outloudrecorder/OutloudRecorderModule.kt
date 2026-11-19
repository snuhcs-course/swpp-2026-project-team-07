package expo.modules.outloudrecorder

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Process
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.net.URI
import java.util.UUID

/** A single AudioRecord keeps running while its writer rotates upload files. */
class OutloudRecorderModule : Module() {
  private val lifecycle = Any()
  @Volatile private var session: Session? = null

  override fun definition() = ModuleDefinition {
    Name("OutloudRecorder")

    AsyncFunction("start") { initialSlide: Int ->
      synchronized(lifecycle) {
        require(initialSlide >= 0) { "Invalid slide index." }
        check(session?.thread?.isAlive != true) { "A recording is already active." }
        val context = appContext.reactContext ?: error("The app is not available.")
        check(context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
          "Microphone permission was denied."
        }
        val root = File(context.filesDir, "outloud-recordings")
        check(root.isDirectory || root.mkdirs()) { "Could not create recording storage." }
        val capture = Session(File(root, UUID.randomUUID().toString()), initialSlide)
        session = capture
        capture.start()
        capture.snapshot()
      }
    }
    Function("transition") { slide: Int ->
      val active = session ?: error("No recording is active.")
      check(active.running) { "The recording has stopped." }
      active.files.transition(slide)
    }
    Function("status") {
      session?.snapshot() ?: error("No recording is active.")
    }
    AsyncFunction("stop") {
      synchronized(lifecycle) { session?.stop() ?: error("No recording is active.") }
    }
    Function("recover") { uri: String ->
      synchronized(lifecycle) {
        check(session?.thread?.isAlive != true) { "Finish the active recording before recovery." }
        val context = appContext.reactContext ?: error("The app is not available.")
        val input = URI(uri)
        require(input.scheme == "file" && input.host.isNullOrEmpty()) { "Invalid recording location." }
        val manifest = File(input).canonicalFile
        val root = File(context.filesDir, "outloud-recordings").canonicalFile
        require(manifest.name == "capture.properties" && manifest.parentFile?.parentFile == root) {
          "The recording is outside app storage."
        }
        PcmCaptureFiles.recover(manifest.parentFile!!)
      }
    }
    OnDestroy {
      synchronized(lifecycle) {
        try { session?.stop() } catch (_: Exception) { /* Native journals retain the last recoverable samples. */ }
      }
    }
  }

  private class Session(directory: File, initialSlide: Int) {
    val files = PcmCaptureFiles(directory, initialSlide)
    @Volatile var running = false
    @Volatile private var failure: String? = null
    var thread: Thread? = null
      private set
    private var microphone: AudioRecord? = null

    fun start() {
      try {
        val minimum = AudioRecord.getMinBufferSize(PcmCaptureFiles.SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        check(minimum > 0) { "This device cannot capture 16 kHz audio." }
        val recorder = AudioRecord.Builder()
          .setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
          .setAudioFormat(AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(PcmCaptureFiles.SAMPLE_RATE).setChannelMask(AudioFormat.CHANNEL_IN_MONO).build())
          .setBufferSizeInBytes(maxOf(minimum * 4, 32_000))
          .build()
        microphone = recorder
        check(recorder.state == AudioRecord.STATE_INITIALIZED) { "The microphone could not be initialized." }
        recorder.startRecording()
        check(recorder.recordingState == AudioRecord.RECORDSTATE_RECORDING) { "The microphone did not start." }
        running = true
        thread = Thread({ capture(recorder) }, "OutLoud-pcm-capture").also { it.start() }
      } catch (e: Exception) {
        running = false
        try { microphone?.release() } finally { microphone = null }
        try { files.finish("The microphone could not start.") } catch (_: Exception) { /* Retain journals. */ }
        throw e
      }
    }

    private fun capture(recorder: AudioRecord) {
      // A 20 ms block defines transition precision; the larger native ring absorbs file fsync work.
      val samples = ShortArray(320)
      try {
        Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO)
        while (running && !files.atLimit()) {
          val count = recorder.read(samples, 0, samples.size, AudioRecord.READ_BLOCKING)
          if (count > 0) files.append(samples, count)
          else if (running && count < 0) error("Microphone read failed.")
        }
      } catch (_: Exception) {
        failure = "Audio capture stopped unexpectedly. The audio is retained for recovery."
      } finally {
        running = false
        try { recorder.stop() } catch (_: Exception) { /* It may already have stopped on device interruption. */ }
        recorder.release()
        try { files.finish(failure) }
        catch (_: Exception) { failure = "Audio finalization failed. Recover the retained recording." }
      }
    }

    fun stop(): Map<String, Any> {
      running = false
      // A blocking read completes within one short capture block. Do not release its AudioRecord concurrently.
      thread?.join(5_000)
      check(thread?.isAlive != true) { "The microphone is still finalizing. Retained files can be recovered." }
      return snapshot()
    }

    fun snapshot(): Map<String, Any> {
      val result = files.snapshot().toMutableMap()
      result["isRecording"] = running
      failure?.let { result["error"] = it }
      return result
    }
  }
}
