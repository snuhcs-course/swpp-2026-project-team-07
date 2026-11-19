import expo.modules.outloudrecorder.PcmCaptureFiles;
import java.io.*;
import java.net.URI;
import java.nio.file.*;
import java.util.*;

public final class PcmCaptureFilesTest {
  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> parts(Map<String, Object> manifest) {
    return (List<Map<String, Object>>)manifest.get("segments");
  }
  private static File file(Object uri) { return new File(URI.create((String)uri)); }
  private static long number(Object n) { return ((Number)n).longValue(); }
  private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
  private static short[] wave(int count, int offset) {
    short[] samples = new short[count];
    for (int i = 0; i < count; i++) samples[i] = (short)(((i + offset) * 17) % 60000 - 30000);
    return samples;
  }
  private static byte[] pcm(File f) throws Exception {
    byte[] bytes = Files.readAllBytes(f.toPath());
    check(bytes.length >= 44, "WAV header");
    check(new String(bytes, 0, 4, "US-ASCII").equals("RIFF"), "RIFF marker");
    long length = 0; for (int i = 0; i < 4; i++) length |= (bytes[40 + i] & 255L) << (i * 8);
    check(length == bytes.length - 44, "WAV length matches actual samples");
    return Arrays.copyOfRange(bytes, 44, bytes.length);
  }
  private static void continuity(Map<String, Object> manifest) throws Exception {
    ByteArrayOutputStream joined = new ByteArrayOutputStream();
    long at = 0; int sequence = 0;
    for (Map<String, Object> p : parts(manifest)) {
      check(number(p.get("sequence")) == sequence++, "stable sequence");
      check(number(p.get("start_ms")) == at, "no gaps or overlaps");
      at = number(p.get("end_ms"));
      check(at - number(p.get("start_ms")) <= 60000, "bounded segment duration");
      joined.write(pcm(file(p.get("uri"))));
    }
    check(at == number(manifest.get("duration_ms")), "full duration covered");
    check(Arrays.equals(pcm(file(manifest.get("full_uri"))), joined.toByteArray()), "segments concatenate to byte-identical full audio");
  }
  public static void main(String[] args) throws Exception {
    if (args.length > 0 && args[0].equals("crash")) {
      PcmCaptureFiles capture = new PcmCaptureFiles(new File(args[1]), 0);
      capture.append(wave(48000, 0), 48000);
      capture.transition(2);
      capture.append(wave(17040, 48000), 17040);
      Runtime.getRuntime().halt(0);
    }
    File root = Files.createTempDirectory("outloud-pcm-test-").toFile();
    PcmCaptureFiles take = new PcmCaptureFiles(new File(root, "visits"), 0);
    take.append(wave(16000, 0), 16000);
    Map<String, Object> one = take.transition(2);
    check(parts(one).size() == 1 && number(parts(one).get(0).get("slide_index")) == 0, "completed visit available before stop");
    check(!(Boolean)one.get("stopped"), "transition does not stop capture");
    take.append(wave(32000, 16000), 32000);
    take.transition(0);
    take.append(wave(16000, 48000), 16000);
    Map<String, Object> finished = take.finish(null);
    continuity(finished);
    check(parts(finished).stream().map(p -> number(p.get("slide_index"))).toList().equals(List.of(0L, 2L, 0L)), "return visits remain separate");
    System.out.println("PASS transitions preserve continuous PCM, original visit order and early sealed files");

    PcmCaptureFiles longSlide = new PcmCaptureFiles(new File(root, "long"), 1);
    longSlide.append(wave(16000 * 121, 0), 16000 * 121);
    check(parts(longSlide.snapshot()).size() == 2, "60-second rotation while recording");
    check(((List<?>)longSlide.snapshot().get("slide_events")).size() == 1, "chunk rotation does not fabricate slide changes");
    continuity(longSlide.finish(null));
    System.out.println("PASS long slide chunks are bounded without changing the slide timeline");

    PcmCaptureFiles quick = new PcmCaptureFiles(new File(root, "quick"), 0);
    quick.transition(1); quick.transition(2);
    quick.append(wave(16000, 0), 16000);
    quick.transition(1); quick.transition(2);
    quick.append(wave(16000, 16000), 16000);
    continuity(quick.finish(null));
    check(parts(PcmCaptureFiles.recover(new File(root, "quick"))).size() == 2, "zero-time transitions do not lose audio on recovery");
    PcmCaptureFiles boundary = new PcmCaptureFiles(new File(root, "boundary"), 0);
    boundary.append(wave(16000, 0), 16000);
    Map<String, Object> beforeStop = boundary.transition(1);
    Map<String, Object> afterStop = boundary.finish(null);
    check(beforeStop.get("slide_events").equals(afterStop.get("slide_events")), "Stop preserves the manifest prefix at an exact boundary");
    check(afterStop.get("slide_events").equals(PcmCaptureFiles.recover(new File(root, "boundary")).get("slide_events")), "recovery preserves final zero-duration visit");
    continuity(afterStop);
    System.out.println("PASS rapid zero-duration transitions and boundary Stop retain the manifest prefix");

    File crashed = new File(root, "crashed");
    Process child = new ProcessBuilder(System.getProperty("java.home") + "/bin/java", "-cp", System.getProperty("java.class.path"),
      "PcmCaptureFilesTest", "crash", crashed.getAbsolutePath()).inheritIO().start();
    check(child.waitFor() == 0, "simulated process exit");
    try (RandomAccessFile tail = new RandomAccessFile(new File(crashed, "segment-00001.wav"), "rw")) { tail.setLength(44); }
    try (FileOutputStream journal = new FileOutputStream(new File(crashed, "segments.tsv"), true)) { journal.write("2\t4\t".getBytes()); }
    Map<String, Object> recovered = PcmCaptureFiles.recover(crashed);
    continuity(recovered);
    check(number(recovered.get("duration_ms")) == 4065, "unsynced checkpoint tail recovered from PCM byte length");
    check((Boolean)recovered.get("stopped"), "recovered take finalized");
    check(parts(PcmCaptureFiles.recover(crashed)).equals(parts(recovered)), "recovery idempotent");
    System.out.println("PASS process death, truncated tail segment and incomplete journal recover without losing full audio");

    PcmCaptureFiles capped = new PcmCaptureFiles(new File(root, "limit"), 0);
    short[] second = wave(16000, 0);
    for (int i = 0; i < 1801; i++) capped.append(second, second.length);
    check(capped.atLimit(), "recording cap reached");
    Map<String, Object> limit = capped.finish(null);
    check(number(limit.get("duration_ms")) == 1800000, "thirty minute capture cap");
    continuity(limit);
    System.out.println("PASS thirty-minute bound and full/segment sample identity");
    System.out.println("All 5 recorder storage checks passed. These do not establish physical microphone continuity.");
  }
}
