import {hasAudio, resourceUrl, sounds} from './media.mjs';

const fadeTime = 0.55;

export class Soundscape {
  constructor() {
    this.context = null;
    this.bus = null;
    this.cache = new Map();
    this.channels = {music: {}, ambience: {}};
    this.level = 0;
  }

  unlock() {
    if (!hasAudio) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    try {
      if (!this.context) {
        this.context = new Context();
        this.bus = this.context.createGain();
        this.bus.gain.value = this.level;
        this.bus.connect(this.context.destination);
      }
      if (this.context.state !== 'running') this.context.resume().catch(() => {});
    } catch {
      // Audio may remain unavailable in browsers or device states that block playback.
    }
  }

  volume(level) {
    this.level = level;
    if (!this.bus) return;
    const time = this.context.currentTime;
    this.bus.gain.setTargetAtTime(level, time, 0.12);
  }

  buffer(id) {
    if (!this.cache.has(id)) {
      this.cache.set(id, fetch(resourceUrl(sounds[id].path)).then(response => {
        if (!response.ok) throw new Error('Audio unavailable');
        return response.arrayBuffer();
      }).then(bytes => new Promise((resolve, reject) => {
        this.context.decodeAudioData(bytes, resolve, reject);
      })).catch(() => {
        this.cache.delete(id);
        return null;
      }));
    }
    return this.cache.get(id);
  }

  fadeOut(track) {
    if (!track) return;
    const time = this.context.currentTime;
    track.gain.gain.setTargetAtTime(0, time, fadeTime / 4);
    track.source.stop(time + fadeTime);
  }

  async loop(name, id) {
    if (!this.context) return;
    const channel = this.channels[name];
    const target = sounds[id]?.status === 'ready' ? id : null;
    if (channel.target === target) return;
    channel.target = target;
    if (!target) {
      this.fadeOut(channel.track);
      channel.track = null;
      return;
    }
    const buffer = await this.buffer(target);
    if (channel.target !== target) return;
    if (!buffer) {
      channel.target = undefined;
      return;
    }
    this.fadeOut(channel.track);
    channel.track = this.play(buffer, true, name === 'music' ? 0.6 : 0.45);
  }

  play(buffer, loop, volume) {
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = loop;
    gain.gain.value = loop ? 0 : volume;
    source.connect(gain);
    gain.connect(this.bus);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    source.start();
    if (loop) gain.gain.linearRampToValueAtTime(volume, this.context.currentTime + fadeTime);
    return {source, gain};
  }

  async effect(id, isCurrent) {
    if (!this.context || !this.level || sounds[id]?.status !== 'ready') return;
    const buffer = await this.buffer(id);
    if (buffer && this.level && isCurrent()) this.play(buffer, false, 0.55);
  }
}
