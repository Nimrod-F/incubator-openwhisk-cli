function main(params) {
    const start = Date.now();
    const delay = params.delay || 2000;    // default 2 000 ms
    const end = start + delay;
    while (Date.now() < end) {
        // busy-wait
    }
    return { output: { start } };
}
