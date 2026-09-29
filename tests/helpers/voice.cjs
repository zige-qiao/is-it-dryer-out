const { createVoiceController } = require('../../src/voice/controller.js');
const { environment, element } = require('./browser.cjs');

exports.flush = () => new Promise(setImmediate);
exports.voiceFixture = ({ ios = true, deferred = false, meterAvailable = true, supported = true } = {}) => {
  const order = [], recognizers = [], tracks = [], frames = new Map(), timers = new Map();
  let nextId = 0, resolveMedia, saved = 0, renders = 0, byteReads = 0, floatReads = 0;
  const elements = new Proxy({}, { get: (target, name) => target[name] ||= element() });
  elements.voiceDialog.hidden = true;
  const nodes = new Map();
  const node = selector => { if (!nodes.has(selector)) nodes.set(selector, element()); return nodes.get(selector); };
  const bars = Array.from({length:5}, element), waveform = element(); waveform.children = bars;
  const document = {
    hidden: false, visibilityState: 'visible', documentElement: {lang:'en-GB'}, createElement: element,
    querySelector: node,
    querySelectorAll: selector => selector === '.voice-waveform' ? [waveform] : selector === '.voice-waveform span' ? bars : [elements.voiceInputButton],
  };
  class Recognition {
    constructor() { Object.assign(this, element()); recognizers.push(this); }
    start() { order.push('recognition start'); this.emit('start'); }
    stop() { order.push('recognition stop'); }
    abort() { order.push('recognition abort'); }
    result(transcript, final = true) { this.emit('result', {results:[Object.assign([{transcript}], {isFinal:final})]}); }
  }
  class AudioContext {
    state = 'running';
    addEventListener() {}
    async resume() { this.state = 'running'; }
    async close() { order.push('context close'); this.state = 'closed'; }
    createMediaStreamSource() { return {connect(){},disconnect(){}}; }
    createAnalyser() { return {
      fftSize:256,
      getByteTimeDomainData(values) { byteReads++; for(let i=0;i<values.length;i++) values[i]=i%2?152:104; },
      getFloatTimeDomainData(values) { floatReads++; values.fill(0.1); },
    }; }
  }
  const media = () => {
    const track = {readyState:'live',enabled:true,addEventListener(){},stop(){order.push('track stop');this.readyState='ended';}};
    tracks.push(track);
    return {getAudioTracks:()=>[track],getTracks:()=>[track]};
  };
  const browser = environment({
    document,
    window: {SpeechRecognition:supported?Recognition:undefined,AudioContext,location:{search:''},matchMedia:()=>({matches:false})},
    navigator: {userAgent:ios?'iPhone':'Desktop',platform:ios?'iPhone':'Win32',maxTouchPoints:ios?5:0,
      mediaDevices: meterAvailable ? {getUserMedia(){order.push('media request');return deferred?new Promise(resolve=>{resolveMedia=()=>resolve(media());}):Promise.resolve(media());}}:undefined},
    performance:{now:()=>0},
    setTimeout(fn,ms){const id=++nextId;timers.set(id,{fn,ms});return id;},
    clearTimeout:id=>timers.delete(id),
    requestAnimationFrame(fn){const id=++nextId;frames.set(id,fn);return id;},
    cancelAnimationFrame:id=>frames.delete(id),
  });
  const state={indoorTemp:24,indoorRh:58};
  const controller=createVoiceController({state,elements,dialogScrollLock:{open:dialog=>dialog.showModal()},saveIndoorReadings(){saved++;},render(){renders++;},formatTemp:v=>`${v}°C`,formatRh:v=>`${v}%`},browser);
  return {controller,state,elements,document,order,recognizers,tracks,frames,timers,bars,
    resolveMedia:()=>resolveMedia(), get saved(){return saved;},get renders(){return renders;},
    get byteReads(){return byteReads;},get floatReads(){return floatReads;},
    tick(ms){for(const [id,timer] of [...timers]) if(timer.ms===ms){timers.delete(id);timer.fn();}},
  };
};
