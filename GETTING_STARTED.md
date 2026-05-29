# 🚀 OpenWhisk CLI - Quick Start Guide

Your CLI is ready to use right now!

---

## 1️⃣ Basic Usage (You Are Here!)

### From the Project Directory

```bash
cd /Users/arisoniga/IdeaProjects/incubator-openwhisk-cli
```

### List Everything
```bash
./wsk list
```

### Invoke an Action
```bash
./wsk action invoke hello --result
```

**Expected output:**
```json
{
    "greeting": "hello world"
}
```

### View Your Actions
```bash
./wsk action list
```

### View Execution History
```bash
./wsk activation list
```

---

## 2️⃣ Easy Access from Anywhere

### Add to PATH (Easiest)

Start a fresh terminal after the setup was done, then:

```bash
# From any directory
wsk list
wsk action invoke hello --result
wsk activation list
```

No need for `./` prefix!

### Or use full path:
```bash
/Users/arisoniga/IdeaProjects/incubator-openwhisk-cli/wsk list
```

---

## 3️⃣ Common Commands

### View Configuration
```bash
wsk property get --all
```

### Get Action Details
```bash
wsk action get hello
```

### View Execution Logs
```bash
wsk activation logs <activation-id>
```

### Create New Action
```bash
# Create from a JS file
wsk action create myaction actions/hello.js
```

### Update Action
```bash
wsk action update hello actions/hello.js
```

### Delete Action
```bash
wsk action delete hello
```

---

## 4️⃣ Advanced: Dagular Workflows (Optional)

Dagular is a simple language for writing complex workflows.

**Simple example:**
```dagular
greeting = hello(name: "Alice")
return greeting
```

**To use Dagular:**
1. Go to project directory
2. Rebuild binary (requires Go): `go build -o wsk main.go`
3. Then: `wsk dag compile myworkflow.dag`
4. Deploy: `wsk dag deploy myworkflow.dag --name myWorkflow`

---

## 5️⃣ Testing Your Setup

Run the comprehensive test:

```bash
/Users/arisoniga/IdeaProjects/incubator-openwhisk-cli/test_cli.sh
```

Results saved to: `/tmp/full_test.txt`

---

## 6️⃣ Key Resources

- **Documentation:** `/Users/arisoniga/IdeaProjects/incubator-openwhisk-cli/README.md`
- **Quick Start:** `/Users/arisoniga/IdeaProjects/incubator-openwhisk-cli/QUICK_START.md`
- **Setup Guide:** `/Users/arisoniga/IdeaProjects/incubator-openwhisk-cli/SETUP_GUIDE.md`
- **Complete Test Results:** `/Users/arisoniga/IdeaProjects/incubator-openwhisk-cli/TEST_REPORT.md`
- **Dagular Overview:** `/Users/arisoniga/IdeaProjects/incubator-openwhisk-cli/DAGULAR_OVERVIEW.md`

---

## 7️⃣ Your OpenWhisk Setup

**API Host:** http://localhost:3233  
**Namespace:** guest  
**Auth:** Already configured ✅

---

## ✨ That's It!

You're all set. Start invoking actions:

```bash
wsk action invoke hello --result
```

Enjoy! 🎉

