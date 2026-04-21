import assert from 'node:assert/strict';

async function main() {
  const {
    CHOREOGRAPHY_PRIORITY_VIDEO_OPTIONS,
    DEFAULT_CHARACTER_VIDEO_OPTIONS,
  } = await import(
    '../src/lib/video-presets'
  );

  assert.equal(DEFAULT_CHARACTER_VIDEO_OPTIONS.duration, 3);
  assert.equal(DEFAULT_CHARACTER_VIDEO_OPTIONS.resolution, '480p');
  assert.equal(DEFAULT_CHARACTER_VIDEO_OPTIONS.ratio, '16:9');
  assert.equal(CHOREOGRAPHY_PRIORITY_VIDEO_OPTIONS.duration, 4);
  assert.equal(CHOREOGRAPHY_PRIORITY_VIDEO_OPTIONS.resolution, '480p');
  assert.equal(CHOREOGRAPHY_PRIORITY_VIDEO_OPTIONS.ratio, '16:9');

  console.log('video presets test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
