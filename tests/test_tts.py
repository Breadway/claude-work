import base64
import io
import unittest
import wave
from narration_alignment import align
from tts_common import decode_response, request_body


class TTSRegressionTests(unittest.TestCase):
    def test_style_is_not_spoken(self):
        body = request_body('Verbatim transcript.', style='Speak briskly.')
        part = body['input'][0]['content'][0]
        self.assertEqual(part['text'], 'Verbatim transcript.')
        self.assertEqual(part['annotations'][0]['style'], 'Speak briskly.')
        self.assertEqual(body['response_format']['mime_type'], 'audio/wav')

    def test_find_audio_after_text_metadata(self):
        buffer = io.BytesIO()
        with wave.open(buffer, 'wb') as audio:
            audio.setparams((1, 2, 24000, 0, 'NONE', 'not compressed'))
            audio.writeframes(b'\x00\x00' * 24000)
        expected = buffer.getvalue()
        response = {'status': 'completed', 'steps': [{'type': 'model_output', 'content': [
            {'type': 'text', 'text': 'metadata'},
            {'type': 'audio', 'data': base64.b64encode(expected).decode()},
        ]}]}
        self.assertEqual(decode_response(response)[0], expected)

    def test_multiple_audio_blocks_join_frames(self):
        buffer = io.BytesIO()
        with wave.open(buffer, 'wb') as audio:
            audio.setparams((1, 2, 24000, 0, 'NONE', 'not compressed'))
            audio.writeframes(b'\x00\x00' * 24000)
        part = {'type': 'audio', 'data': base64.b64encode(buffer.getvalue()).decode()}
        response = {'status': 'completed', 'steps': [{'type': 'model_output', 'content': [part, part]}]}
        with wave.open(io.BytesIO(decode_response(response)[0])) as audio:
            self.assertEqual(audio.getnframes(), 48000)

    def test_no_audio_does_not_become_a_cached_wav(self):
        with self.assertRaises(ValueError):
            decode_response({'status': 'completed', 'steps': []})

    def test_incomplete_interaction_is_rejected(self):
        with self.assertRaises(ValueError):
            decode_response({'status': 'in_progress'})

    def test_no_pauses(self):
        onsets, *_ = align(12, [], [10, 20, 30])
        self.assertEqual(onsets, [0, 2, 6])

    def test_one_caption_without_pauses(self):
        self.assertEqual(align(4, [], [20])[0], [0])

    def test_boundaries_are_strictly_increasing(self):
        pauses = [(i, i + 0.2) for i in range(1, 10)]
        onsets, *_ = align(12, pauses, [10, 10, 80, 10, 10])
        self.assertTrue(all(a < b for a, b in zip(onsets, onsets[1:])))
        self.assertTrue(all(0 <= t < 12 for t in onsets))

    def test_invalid_audio_and_caption_lengths(self):
        for duration, lengths in [(0, [1]), (4, []), (4, [0]), (4, [-1])]:
            with self.subTest(duration=duration, lengths=lengths):
                with self.assertRaises(ValueError):
                    align(duration, [], lengths)


if __name__ == '__main__':
    unittest.main()
