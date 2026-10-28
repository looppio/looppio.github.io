import * as THREE from 'three';

// Origin's hero sky is a muted 25.73s video. It belongs to the scene so the
// existing lens and page wipe sample moving clouds, not a separate DOM layer.
export default class AnimatedSky {
  constructor(scene, host) {
    this.scene = scene;
    this.host = host;
    this.width = this.height = 1;
    this.destroyed = false;
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
  }

  async start() {
    const poster = await new THREE.TextureLoader().loadAsync('/assets/origin-sky-poster.jpg');
    if (this.destroyed) {
      poster.dispose();
      return;
    }
    poster.colorSpace = THREE.NoColorSpace;
    this.poster = poster;
    this.scene.background = poster;

    const video = (this.video = document.createElement('video'));
    video.className = 'scene-sky-video';
    video.setAttribute('aria-hidden', 'true');
    video.setAttribute('playsinline', '');
    video.tabIndex = -1;
    video.muted = video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = this.motion.matches ? 'none' : 'auto';
    video.src = '/assets/origin-sky.mp4';
    this.host.appendChild(video);
    this.texture = new THREE.VideoTexture(video);
    // The reference pipeline samples display values directly. Do not apply a
    // second sRGB decode to the video while the project textures stay raw.
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.minFilter = this.texture.magFilter = THREE.LinearFilter;

    this.onReady = () => {
      if (
        this.destroyed ||
        this.motion.matches ||
        document.hidden ||
        video.readyState < 2 ||
        !video.videoWidth ||
        !video.videoHeight
      )
        return;
      this.resize(this.width, this.height);
      this.scene.background = this.texture;
    };
    this.onError = () => {
      if (!this.destroyed) this.scene.background = this.poster;
    };
    this.onPlayback = () => this.syncPlayback();
    video.addEventListener('loadeddata', this.onReady);
    video.addEventListener('error', this.onError);
    document.addEventListener('visibilitychange', this.onPlayback);
    this.motion.addEventListener('change', this.onPlayback);
    // Some mobile power-saving modes block autoplay until the first gesture.
    this.onGesture = () => {
      if (video.paused) this.syncPlayback();
    };
    document.addEventListener('pointerdown', this.onGesture, { passive: true });
    document.addEventListener('keydown', this.onGesture);
    this.resize(this.width, this.height);
    this.syncPlayback();
  }

  syncPlayback() {
    if (this.destroyed || !this.video) return;
    const video = this.video;
    if (this.motion.matches || document.hidden) {
      this.playRequest = null;
      video.pause();
      if (this.motion.matches) this.scene.background = this.poster;
      return;
    }
    if (this.playRequest) return;
    if (!video.paused) {
      this.onReady();
      return;
    }
    const request = {};
    this.playRequest = request;
    Promise.resolve(video.play())
      .then(() => {
        // play() may settle after a tab hide, motion-policy change or teardown.
        // A stale request must never restart a paused background video.
        if (this.destroyed || document.hidden || this.motion.matches) {
          video.pause();
          return;
        }
        if (this.playRequest === request) this.onReady();
      })
      .catch(() => {
        if (!this.destroyed && this.playRequest === request && video.readyState < 2)
          this.scene.background = this.poster;
      })
      .finally(() => {
        if (this.playRequest === request) this.playRequest = null;
      });
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    const viewport = width / height;
    for (const texture of [this.poster, this.texture]) {
      if (!texture) continue;
      const image = texture.image;
      const imageWidth = image.videoWidth || image.naturalWidth || image.width;
      const imageHeight = image.videoHeight || image.naturalHeight || image.height;
      if (!imageWidth || !imageHeight) continue;
      const aspect = imageWidth / imageHeight;
      texture.repeat.set(Math.min(1, viewport / aspect), Math.min(1, aspect / viewport));
      texture.offset.set((1 - texture.repeat.x) / 2, (1 - texture.repeat.y) / 2);
      texture.updateMatrix();
    }
  }

  dispose() {
    this.destroyed = true;
    this.playRequest = null;
    if (this.video) {
      this.video.removeEventListener('loadeddata', this.onReady);
      this.video.removeEventListener('error', this.onError);
      document.removeEventListener('visibilitychange', this.onPlayback);
      this.motion.removeEventListener('change', this.onPlayback);
      document.removeEventListener('pointerdown', this.onGesture);
      document.removeEventListener('keydown', this.onGesture);
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
      this.video.remove();
    }
    if (this.scene.background === this.texture || this.scene.background === this.poster)
      this.scene.background = null;
    this.texture?.dispose();
    this.poster?.dispose();
  }
}
