# Additional reproduction for #1514: stale and premature automaticOffset measurements

I have a standalone component reproduction against 1.22.7 for the async measurement part of this report. The natural native race has not been tested in this standalone app yet.

The KAV cases exercise the real installed component while explicitly simulating native responses:

- A positive React layout followed by a native response with zero/unusable dimensions.
- An older position response arriving after a newer layout response.
- A response arriving after the native target changes or after unmount.
- Initial measurement while the keyboard is already open.

With a simulated window height 640, keyboard height 250, React layout height 474 and valid absolute y48, the expected rendered KAV height is 342. Accepting premature y0 initializes a different height, and a later valid response can be ignored by the existing initial-frame guard.

The reproduction includes a pnpm-applied patch that checks measurement generation/target and retries unusable native dimensions. Both variants use the same native controller 1.22.7 code. The JS tests are deterministic; the app also contains a natural mount/autofocus screen whose race occurrence depends on device/timing.

Important limitation of this candidate patch: retries remain unbounded while a mounted view keeps returning invalid dimensions. It preserves the existing fallback when the native call rejects, so it does not resolve the rejected-measurement fallback described in #1594.

The separate KASV viewport correction is independently tested and should be reviewed separately from this measurement issue. See the repository README and `evidence/component-tests.json` for commands, results and native validation limits.
