function main(params) {
    const to       = params.to       || "unknown@domain";
    const template = params.template || "defaultTemplate";

    return {
        output: {
            status:   "sent",
            to:       to,
            template: template,
            timestamp: new Date().toISOString()
        }
    };
}


// function welcomeAll() {
//     const emailer = template => user =>
//         invoke("/_/sendEmail", { to: user, template });
//
//     const welcomeEmail = emailer("welcomeTemplate");
//     const users = ["alice@example.com", "bob@example.com", "carol@example.com"];
//     const results = users.map(u => welcomeEmail(u)); => emailer("welcomeTemplate")(user)
//
//     return results;
// }

// block {
//     let emailer      = λ template. λ user. invoke("/_/sendEmail", {to:user, template:template})
//     let welcomeEmail = emailer("welcomeTemplate")
//     let users        = ["alice@example.com", "bob@example.com", "carol@example.com"]
//     let results      = map(welcomeEmail, users)
//     return results
// }


