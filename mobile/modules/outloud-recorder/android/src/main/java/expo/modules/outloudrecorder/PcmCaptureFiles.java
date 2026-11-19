package expo.modules.outloudrecorder;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** One sample clock and durable files, independent of the microphone and React lifecycle. */
public final class PcmCaptureFiles {
  public static final int SAMPLE_RATE = 16000;
  public static final long CHUNK_FRAMES = 60L * SAMPLE_RATE;
  public static final long MAX_FRAMES = 1800L * SAMPLE_RATE;
  private final File directory;
  private final RandomAccessFile full;
  private RandomAccessFile segment;
  private final List<Part> sealed = new ArrayList<>();
  private final List<Event> events = new ArrayList<>();
  private Part current;
  private long frames, checkpointFrames;
  private boolean stopped;
  private double metering = -160;
  private String error;

  private static final class Part {
    final int sequence, slide;
    final long start;
    long end;
    Part(int sequence, int slide, long start) {
      this.sequence = sequence; this.slide = slide; this.start = start;
    }
    String name() { return String.format(Locale.ROOT, "segment-%05d.wav", sequence); }
    Map<String, Object> map(File dir) {
      Map<String, Object> m = new LinkedHashMap<>();
      m.put("sequence", sequence); m.put("slide_index", slide);
      m.put("start_ms", millis(start)); m.put("end_ms", millis(end));
      m.put("uri", uri(new File(dir, name())));
      return m;
    }
  }
  private static final class Event {
    final int slide;
    final long frame;
    Event(int slide, long frame) { this.slide = slide; this.frame = frame; }
    Map<String, Object> map() {
      Map<String, Object> m = new LinkedHashMap<>();
      m.put("slide_index", slide); m.put("at_ms", millis(frame)); return m;
    }
  }
  private static String uri(File file) { return file.toURI().toString().replaceFirst("^file:/", "file:///"); }
  private static long millis(long frames) { return frames * 1000L / SAMPLE_RATE; }

  public PcmCaptureFiles(File directory, int initialSlide) throws IOException {
    if (initialSlide < 0) throw new IllegalArgumentException("Invalid slide index.");
    this.directory = directory;
    if (!directory.mkdir()) throw new IOException("Could not create recording directory.");
    full = new RandomAccessFile(new File(directory, "full.wav"), "rw");
    try {
      header(full, 0);
      event(initialSlide);
      openPart(0, initialSlide);
      persistState(false);
    } catch (IOException | RuntimeException e) {
      full.close();
      if (segment != null) segment.close();
      throw e;
    }
  }

  public synchronized void append(short[] samples, int count) throws IOException {
    if (stopped) throw new IOException("Recording is already stopped.");
    if (count < 0 || count > samples.length) throw new IllegalArgumentException("Invalid sample count.");
    int offset = 0;
    long squares = 0;
    while (offset < count && frames < MAX_FRAMES) {
      int n = (int)Math.min(count - offset, Math.min(CHUNK_FRAMES - (frames - current.start), MAX_FRAMES - frames));
      byte[] bytes = new byte[n * 2];
      for (int i = 0; i < n; i++) {
        short sample = samples[offset + i];
        bytes[i * 2] = (byte)sample; bytes[i * 2 + 1] = (byte)(sample >> 8);
        squares += (long)sample * sample;
      }
      // The full file is the recovery authority if the segment write is interrupted.
      full.write(bytes);
      frames += n;
      segment.write(bytes);
      offset += n;
      if (frames - current.start == CHUNK_FRAMES) {
        int nextSequence = current.sequence + 1, slide = current.slide;
        seal();
        openPart(nextSequence, slide);
        checkpoint();
      }
    }
    metering = offset == 0 || squares == 0 ? -160 : 20.0 * Math.log10(Math.sqrt((double)squares / offset) / 32768.0);
    if (frames - checkpointFrames >= SAMPLE_RATE) checkpoint();
  }

  public synchronized Map<String, Object> transition(int slide) throws IOException {
    if (stopped) throw new IOException("Recording is already stopped.");
    if (slide < 0) throw new IllegalArgumentException("Invalid slide index.");
    if (slide == current.slide) return snapshot();
    int next = current.sequence + (frames > current.start ? 1 : 0);
    seal();
    event(slide);
    openPart(next, slide);
    checkpoint();
    return snapshot();
  }

  public synchronized boolean atLimit() { return frames >= MAX_FRAMES; }

  public synchronized Map<String, Object> finish(String failure) throws IOException {
    if (stopped) return snapshot();
    error = failure;
    IOException failed = null;
    try {
      seal();
      header(full, frames);
      full.getFD().sync();
    } catch (IOException e) { failed = e; error = "Audio finalization failed. Recover the retained files."; }
    finally {
      stopped = true;
      try { if (segment != null) segment.close(); } catch (IOException e) { if (failed == null) failed = e; }
      try { full.close(); } catch (IOException e) { if (failed == null) failed = e; }
    }
    persistState(true);
    if (failed != null) throw failed;
    return snapshot();
  }

  public synchronized Map<String, Object> snapshot() {
    Map<String, Object> m = base(directory, frames, stopped, metering, current.slide, error);
    List<Map<String, Object>> parts = new ArrayList<>();
    for (Part p : sealed) parts.add(p.map(directory));
    List<Map<String, Object>> timeline = new ArrayList<>();
    for (Event e : events) timeline.add(e.map());
    m.put("segments", parts); m.put("slide_events", timeline);
    return m;
  }

  private void event(int slide) throws IOException {
    appendJournal("events.tsv", slide + "\t" + frames + "\n");
    events.add(new Event(slide, frames));
  }
  private void openPart(int sequence, int slide) throws IOException {
    current = new Part(sequence, slide, frames);
    // Repeated zero-length transitions replace only an empty segment, never prior samples.
    appendJournal("segments.tsv", sequence + "\t" + slide + "\t" + frames + "\n");
    segment = new RandomAccessFile(new File(directory, current.name()), "rw");
    if (segment.length() > 44) throw new IOException("Refusing to replace recorded audio.");
    header(segment, 0);
  }
  private void seal() throws IOException {
    if (segment == null) return;
    current.end = frames;
    header(segment, frames - current.start);
    segment.getFD().sync();
    segment.close(); segment = null;
    if (current.end > current.start) sealed.add(current);
  }
  private void checkpoint() throws IOException {
    header(full, frames);
    header(segment, frames - current.start);
    full.getFD().sync(); segment.getFD().sync();
    persistState(false); checkpointFrames = frames;
  }
  private void appendJournal(String name, String row) throws IOException {
    try (FileOutputStream output = new FileOutputStream(new File(directory, name), true)) {
      output.write(row.getBytes(StandardCharsets.UTF_8)); output.getFD().sync();
    }
  }
  private void persistState(boolean ended) throws IOException {
    Properties props = new Properties();
    props.setProperty("version", "1"); props.setProperty("sample_rate", String.valueOf(SAMPLE_RATE));
    props.setProperty("frames", String.valueOf(frames)); props.setProperty("stopped", String.valueOf(ended));
    if (error != null) props.setProperty("error", error);
    writeState(directory, props);
  }
  private static void writeState(File directory, Properties props) throws IOException {
    File temp = new File(directory, "capture.properties.tmp");
    try (FileOutputStream out = new FileOutputStream(temp)) { props.store(out, "OutLoud continuous audio"); out.getFD().sync(); }
    if (!temp.renameTo(new File(directory, "capture.properties"))) throw new IOException("Could not persist recording checkpoint.");
  }
  private static Map<String, Object> base(File dir, long frames, boolean stopped, double meter, int slide, String error) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("manifest_uri", uri(new File(dir, "capture.properties")));
    m.put("full_uri", uri(new File(dir, "full.wav")));
    m.put("duration_ms", millis(frames)); m.put("stopped", stopped); m.put("isRecording", !stopped);
    m.put("metering", meter); m.put("current_slide", slide);
    if (error != null) m.put("error", error);
    return m;
  }

  /** Recover from the full PCM bytes and fsynced boundaries, including a partially written tail. */
  public static Map<String, Object> recover(File directory) throws IOException {
    File fullFile = new File(directory, "full.wav");
    if (!fullFile.isFile() || fullFile.length() < 44) throw new IOException("No recoverable audio file.");
    long frames = Math.min(MAX_FRAMES, (fullFile.length() - 44) / 2);
    TreeMap<Integer, Part> parts = new TreeMap<>();
    for (String row : rows(new File(directory, "segments.tsv"))) {
      String[] values = row.split("\t");
      if (values.length != 3) throw new IOException("Invalid recording boundary journal.");
      try {
        int sequence = Integer.parseInt(values[0]), slide = Integer.parseInt(values[1]);
        long start = Long.parseLong(values[2]);
        if (sequence < 0 || slide < 0 || start < 0 || start > frames) throw new IOException("Invalid recording boundary.");
        parts.put(sequence, new Part(sequence, slide, start));
      } catch (NumberFormatException e) { throw new IOException("Invalid recording boundary journal.", e); }
    }
    if (parts.isEmpty() || parts.firstKey() != 0 || parts.firstEntry().getValue().start != 0)
      throw new IOException("The initial audio boundary is missing.");
    List<Part> ordered = new ArrayList<>(parts.values());
    List<Map<String, Object>> recovered = new ArrayList<>();
    try (RandomAccessFile audio = new RandomAccessFile(fullFile, "rw")) {
      audio.setLength(44 + frames * 2); header(audio, frames); audio.getFD().sync();
      for (int i = 0; i < ordered.size(); i++) {
        Part part = ordered.get(i);
        part.end = i + 1 < ordered.size() ? ordered.get(i + 1).start : frames;
        if (part.sequence != i || part.end < part.start || part.end - part.start > CHUNK_FRAMES)
          throw new IOException("Recording boundaries are not contiguous.");
        if (part.end == part.start) continue;
        File target = new File(directory, part.name());
        if (!target.isFile() || target.length() != 44 + (part.end - part.start) * 2) {
          try (RandomAccessFile out = new RandomAccessFile(target, "rw")) {
            out.setLength(0); header(out, part.end - part.start);
            audio.seek(44 + part.start * 2);
            byte[] buffer = new byte[32768];
            long bytes = (part.end - part.start) * 2;
            while (bytes > 0) { int n = (int)Math.min(bytes, buffer.length); audio.readFully(buffer, 0, n); out.write(buffer, 0, n); bytes -= n; }
            out.getFD().sync();
          }
        } else {
          try (RandomAccessFile out = new RandomAccessFile(target, "rw")) { header(out, part.end - part.start); out.getFD().sync(); }
        }
        recovered.add(part.map(directory));
      }
    }
    List<Map<String, Object>> timeline = new ArrayList<>();
    long previous = -1;
    int lastSlide = ordered.get(0).slide;
    for (String row : rows(new File(directory, "events.tsv"))) {
      String[] values = row.split("\t");
      if (values.length != 2) throw new IOException("Invalid slide journal.");
      int slide; long at;
      try { slide = Integer.parseInt(values[0]); at = Long.parseLong(values[1]); }
      catch (NumberFormatException e) { throw new IOException("Invalid slide journal.", e); }
      if (slide < 0 || at < previous || at > frames || (previous < 0 && at != 0)) throw new IOException("Invalid slide boundary.");
      timeline.add(new Event(slide, at).map()); lastSlide = slide;
      previous = at;
    }
    if (frames > 0 && timeline.isEmpty()) throw new IOException("The initial slide is missing.");
    Properties props = new Properties(); props.setProperty("version", "1"); props.setProperty("sample_rate", "16000");
    props.setProperty("frames", String.valueOf(frames)); props.setProperty("stopped", "true"); writeState(directory, props);
    Map<String, Object> result = base(directory, frames, true, -160, lastSlide, null);
    result.put("segments", recovered); result.put("slide_events", timeline);
    return result;
  }
  private static List<String> rows(File file) throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    try (InputStream input = new FileInputStream(file)) {
      byte[] b = new byte[4096]; int n;
      while ((n = input.read(b)) != -1) {
        if (out.size() + n > 2_000_000) throw new IOException("Recording journal is too large.");
        out.write(b, 0, n);
      }
    }
    String text = new String(out.toByteArray(), StandardCharsets.UTF_8);
    int last = text.lastIndexOf('\n');
    if (last < 0) return Collections.emptyList();
    return Arrays.asList(text.substring(0, last).split("\n"));
  }
  private static void header(RandomAccessFile file, long frames) throws IOException {
    long position = file.getFilePointer();
    file.seek(0); file.writeBytes("RIFF"); le32(file, 36 + frames * 2); file.writeBytes("WAVEfmt ");
    le32(file, 16); le16(file, 1); le16(file, 1); le32(file, SAMPLE_RATE); le32(file, SAMPLE_RATE * 2);
    le16(file, 2); le16(file, 16); file.writeBytes("data"); le32(file, frames * 2);
    file.seek(Math.max(44, position));
  }
  private static void le16(RandomAccessFile f, int v) throws IOException { f.write(v); f.write(v >> 8); }
  private static void le32(RandomAccessFile f, long v) throws IOException { for (int i = 0; i < 4; i++) f.write((int)(v >> (8 * i))); }
}
