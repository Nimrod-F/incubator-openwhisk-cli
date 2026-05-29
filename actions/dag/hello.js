// @param name: string
// @returns: string
function main(params) {
    let name = params.name || "World";
    return { greeting: "Hello " + name + "!" };
}
