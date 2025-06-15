# create-actions.ps1

# Define your actions in this array using the format:
# "actionName:actionFile:actionType"
# where actionType is either "regular" or "dagular"
$Actions = @(
    "add:adder.js:regular"
    "current_user:current_user.js:regular"
    "functionA:functionA.js:regular"
    "functionB:functionB.js:regular"
    "hello:hello.js:regular"
    "sendEmail:sendEmail.js:regular"
    "slow2:slow2.js:regular"
    "slow3:slow3.js:regular"
    "world:world.js:regular"
    "2-actions:working/2-actions.json:dagular"
    "2-actions-index:working/2-actions-index.json:dagular"
    "emailer:working/emailer.json:dagular"
    "greet:working/greet.json:dagular"
    "if_expr:working/if_expr.json:dagular"
    "lambda:working/lambda.json:dagular"
    "parallel-actions:working/parallel-actions.json:dagular"
    "working:working/working.json:dagular"
)

# Base directory where your action files are located
$ActionsDir = "."

foreach ($entry in $Actions) {
    # Split into name, file, type
    $parts      = $entry -split ':'
    $actionName = $parts[0]
    $actionFile = $parts[1]
    $actionType = $parts[2]

    $actionPath = Join-Path $ActionsDir $actionFile

    Write-Host "Creating $actionType action: $actionName from $actionPath"

    if ($actionType -eq 'dagular') {
        wsk action create --dagular $actionName $actionPath
    }
    else {
        wsk action create $actionName $actionPath
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Successfully created $actionName" -ForegroundColor Green
    }
    else {
        Write-Host "Failed to create $actionName" -ForegroundColor Red
    }

    Write-Host
}
