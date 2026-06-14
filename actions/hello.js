function main(params) {
  return {
    output: {
      message: "Hello, " + (params.name || "stranger") + "!",
    },
  };
}

// // hello.js
// function main(params) {
//   return { output: "Hello, " + (params.name||"stranger") + "!" };
// }
