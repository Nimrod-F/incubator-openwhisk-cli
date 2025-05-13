function main(params) {
    return {
        output: {
            message: (params.msg || "stranger") + ", world!"
        }
    };
}
