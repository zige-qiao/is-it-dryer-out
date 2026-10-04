# Local OCR assets

Pinned upstream distributions; no application build step or CDN request at runtime:

- `tesseract.min.js`, `worker.min.js`: [Tesseract.js 6.0.1](https://github.com/naptha/tesseract.js/tree/v6.0.1), Apache-2.0; see `LICENSE.md`.
- `core/*`: [tesseract.js-core 6.0.0](https://www.npmjs.com/package/tesseract.js-core/v/6.0.0), Apache-2.0; see `core/LICENSE`. The SIMD and non-SIMD LSTM wrappers embed their WebAssembly. Legacy engines are not used.
- `lang/eng.traineddata.gz`: [`@tesseract.js-data/eng` 1.0.0, `4.0.0_best_int`](https://www.npmjs.com/package/@tesseract.js-data/eng), Apache-2.0 English model data, distributed from the official npm package.

Downloads came from pinned jsDelivr npm URLs. Change the recognition asset cache version when replacing an asset. These files are cached lazily on first recognition, independently of the normal app shell. Photos and draft readings are never stored in that cache.
