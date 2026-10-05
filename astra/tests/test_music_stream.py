import tempfile
import unittest
import wave
from pathlib import Path
import numpy as np
from music_stream import SR, impulse, render_window, write_score


class StreamingScoreTests(unittest.TestCase):
    def test_chunks_keep_notes_noise_and_reverb_continuous(self):
        timeline = {'total': 15.2, 'scenes': [
            {'id': 'one', 'start': 0, 'ch': 11},
            {'id': 'two', 'start': 6.3, 'ch': 12},
            {'id': 'three', 'start': 11.1, 'ch': 15},
        ]}
        impulses = (impulse(300007), impulse(300008))
        count = int((timeline['total'] + 1.5) * SR)
        cut = int(8.13 * SR)
        whole = render_window(timeline, 'edu', 0, count, impulses)
        chunked = np.concatenate([
            render_window(timeline, 'edu', 0, cut, impulses),
            render_window(timeline, 'edu', cut, count, impulses),
        ])
        self.assertLess(float(np.max(np.abs(whole - chunked))), 1e-6)
        self.assertGreater(float(np.sqrt(np.mean(whole ** 2))), .01)
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory, 'music.wav')
            write_score(timeline, 'edu', output, chunk_seconds=8.13)
            with wave.open(str(output)) as reader:
                self.assertEqual(reader.getnchannels(), 2)
                self.assertEqual(reader.getframerate(), SR)
                self.assertEqual(reader.getnframes(), int(timeline['total'] * SR) + int(1.5 * SR))
                pcm = np.frombuffer(reader.readframes(reader.getnframes()), '<i2')
                self.assertLessEqual(np.max(np.abs(pcm)), 29491)


if __name__ == '__main__':
    unittest.main()
