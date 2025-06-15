function main(params) {
    const greeting = params.msg || { message: "stranger" };
    return {
        output: {
            message: greeting.message + ", world!"
        }
    };
}
