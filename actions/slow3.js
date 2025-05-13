function main(params) {
    const start = Date.now();
    const delay = params.delay || 3000;    // default 3 000 ms
    const end = start + delay;
    while (Date.now() < end) {
        // busy-wait
    }
    return { output: { start } };
}
