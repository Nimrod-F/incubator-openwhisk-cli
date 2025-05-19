#!/bin/bash

# Define your actions in this array using the format:
# "actionName:actionFile:actionType"
# where actionType is either "regular" or "dagular"
ACTIONS=(
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
ACTIONS_DIR="./"

for entry in "${ACTIONS[@]}"; do
  IFS=':' read -r action_name action_file action_type <<< "$entry"

  action_path="$ACTIONS_DIR/$action_file"

  echo "Creating $action_type action: $action_name from $action_path"

  if [ "$action_type" = "dagular" ]; then
    wsk action create --dagular "$action_name" "$action_path"
  else
    wsk action create "$action_name" "$action_path"
  fi

  if [ $? -eq 0 ]; then
    echo "Successfully created $action_name"
  else
    echo "Failed to create $action_name"
  fi

  echo
done