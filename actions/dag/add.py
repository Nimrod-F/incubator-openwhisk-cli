# @param a: number
# @param b: number
# @returns: number
def main(params):
    a = params.get("a", 0)
    b = params.get("b", 0)
    return {"result": a + b}
