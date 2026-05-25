#!/bin/bash
# deploy-api-surreal.sh
# Deploys the SurrealDB TypeScript service files to the api app on Contabo
# Run: bash deploy-api-surreal.sh

SERVER="root@147.93.190.166"
APP="/home/api/app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$SCRIPT_DIR/api-surreal-src"

echo "=== Deploying SurrealDB service files to Contabo ==="

# Backup original files
sshpass -p 'Malachi77' ssh -o StrictHostKeyChecking=no "$SERVER" "
  cd $APP/src
  cp -r services services.mysql-bak 2>/dev/null || true
  cp lib/surreal.ts lib/surreal.ts.bak 2>/dev/null || true
  mkdir -p lib
  echo 'Backup done'
"

# Deploy lib files
sshpass -p 'Malachi77' scp -o StrictHostKeyChecking=no \
  "$SRC/lib/surreal.ts" "$SERVER:$APP/src/lib/surreal.ts"
sshpass -p 'Malachi77' scp -o StrictHostKeyChecking=no \
  "$SRC/lib/geminiDb.ts" "$SERVER:$APP/src/lib/geminiDb.ts"

echo "✓ lib files deployed"

# Deploy UserServices
for f in AuthUserSerice CreateUserService ListUsersService UpdateUserService DeleteUserService ShowUserService UpdateUserConfigsService; do
  sshpass -p 'Malachi77' scp -o StrictHostKeyChecking=no \
    "$SRC/services/UserServices/${f}.ts" "$SERVER:$APP/src/services/UserServices/${f}.ts" 2>/dev/null || \
    echo "  SKIP $f (file not found)"
done
echo "✓ UserServices deployed"

# Deploy ClientServices
for f in ListClientsService ShowClientService CreateClientService UpdateClientService DeleteClientService UpdateClientProgressService UpdateExtraInfoClientService; do
  sshpass -p 'Malachi77' scp -o StrictHostKeyChecking=no \
    "$SRC/services/ClientServices/${f}.ts" "$SERVER:$APP/src/services/ClientServices/${f}.ts"
done
echo "✓ ClientServices deployed"

# Deploy ReportDataServices
for f in CreateReportDataService GetReportDataByClientId GetReportDataByClientIdAndReportId GetReportDataById UpdateProgressReport GetProgressReport; do
  sshpass -p 'Malachi77' scp -o StrictHostKeyChecking=no \
    "$SRC/services/ReportDataServices/${f}.ts" "$SERVER:$APP/src/services/ReportDataServices/${f}.ts" 2>/dev/null || \
    echo "  SKIP $f"
done
echo "✓ ReportDataServices deployed"

# Deploy TemplateServices
for f in ListTemplateService CreateTemplateService UpdateTemplateService DeleteTemplateService; do
  sshpass -p 'Malachi77' scp -o StrictHostKeyChecking=no \
    "$SRC/services/TemplateServices/${f}.ts" "$SERVER:$APP/src/services/TemplateServices/${f}.ts"
done
echo "✓ TemplateServices deployed"

# Deploy ParaghraphServices
for f in ListParaghraphService CreateParaghraphService UpdateParaghraphService DeleteParaghraphService; do
  sshpass -p 'Malachi77' scp -o StrictHostKeyChecking=no \
    "$SRC/services/ParaghraphServices/${f}.ts" "$SERVER:$APP/src/services/ParaghraphServices/${f}.ts"
done
echo "✓ ParaghraphServices deployed"

# Deploy AlternateLetters
for f in ListAlternateLettersService CreateAlternateLettersService UpdateAlternateLettersService DeleteAlternateLettersService; do
  sshpass -p 'Malachi77' scp -o StrictHostKeyChecking=no \
    "$SRC/services/AlternateLetters/${f}.ts" "$SERVER:$APP/src/services/AlternateLetters/${f}.ts"
done
echo "✓ AlternateLetters deployed"

# Deploy CreditorContactsServices
for f in ListCreditorContactsService CreateCreditorContactsService UpdateCreditorContactsService DeleteCreditorContactsService; do
  sshpass -p 'Malachi77' scp -o StrictHostKeyChecking=no \
    "$SRC/services/CreditorContactsServices/${f}.ts" "$SERVER:$APP/src/services/CreditorContactsServices/${f}.ts"
done
echo "✓ CreditorContactsServices deployed"

# Deploy GeminiService AddGemini
sshpass -p 'Malachi77' scp -o StrictHostKeyChecking=no \
  "$SRC/services/GeminiService/AddGemini.ts" "$SERVER:$APP/src/services/GeminiService/AddGemini.ts"
echo "✓ GeminiService/AddGemini deployed"

echo ""
echo "=== Patching GeminiService.ts to use SurrealDB ==="
sshpass -p 'Malachi77' ssh -o StrictHostKeyChecking=no "$SERVER" "
cd $APP
node -e \"
const fs = require('fs');
const path = '$APP/src/services/GeminiService/GeminiService.ts';
let code = fs.readFileSync(path, 'utf8');
let patched = 0;

// Replace Sequelize imports with SurrealDB equivalents
const oldImports = \`import { GenerationConfig, GoogleGenAI } from \"@google/genai\";
import sequelize from \"../../config/database\";
import GeminiKey from \"../../models/GeminiKey\";
import GeminiUsage from \"../../models/GeminiUsage\";
import { Op } from \"sequelize\";\`;

const newImports = \`import { GenerationConfig, GoogleGenAI } from \"@google/genai\";
import { GeminiKey, GeminiUsage, sequelizeStub as sequelize } from \"../../lib/geminiDb\";\`;

if (code.includes('import sequelize from \"../../config/database\"')) {
  code = code.replace(oldImports, newImports);
  patched++;
  console.log('✓ Replaced GeminiService imports');
} else {
  // Already patched or different format
  console.log('WARN: GeminiService imports already patched or different');
}

fs.writeFileSync(path, code, 'utf8');
console.log('GeminiService patched:', patched, 'replacements');
\"
"

echo ""
echo "=== Patching database.ts to suppress MySQL connection errors ==="
sshpass -p 'Malachi77' ssh -o StrictHostKeyChecking=no "$SERVER" "
cp $APP/src/config/database.ts $APP/src/config/database.ts.mysql-bak 2>/dev/null || true
cat > $APP/src/config/database.ts << 'DBEOF'
// src/config/database.ts
// SurrealDB migration: MySQL is no longer used
// This stub keeps TypeScript happy for any remaining Sequelize imports

import { Sequelize } from 'sequelize';
import { logger } from '../utils/logger';

// Create a disabled Sequelize instance (no real connection)
const sequelize = new Sequelize('', '', '', {
  dialect: 'mysql',
  host: '127.0.0.1',
  logging: false,
  pool: { max: 0, min: 0, acquire: 100, idle: 100 },
});

// Do NOT authenticate — MySQL is no longer the database
// sequelize.authenticate() removed

export default sequelize;
DBEOF
echo '✓ database.ts stub created'
"

echo ""
echo "=== Building TypeScript ==="
sshpass -p 'Malachi77' ssh -o StrictHostKeyChecking=no "$SERVER" "
cd $APP
npm run build 2>&1 | tail -30
"

echo ""
echo "=== Restarting api app ==="
sshpass -p 'Malachi77' ssh -o StrictHostKeyChecking=no "$SERVER" "
pm2 describe api 2>/dev/null | head -5
# Try to find the api app's pm2 process
pm2 list | grep -E '3003|api'
# Restart
pm2 restart \$(pm2 list | grep '3003' | awk '{print \$2}' | head -1) 2>/dev/null || \
  pm2 restart \$(pm2 list | grep 'api' | awk '{print \$2}' | head -1) 2>/dev/null || \
  echo 'Could not restart via pm2 - check manually'
"

echo ""
echo "=== Deploy complete ==="
