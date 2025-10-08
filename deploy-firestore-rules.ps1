# Deploy Firestore Security Rules
# This script deploys the updated firestore.rules to fix permission errors

Write-Host "🔒 Deploying Updated Firestore Security Rules..." -ForegroundColor Cyan
Write-Host ""

# Check if Firebase CLI is installed
try {
    $firebaseVersion = firebase --version
    Write-Host "✅ Firebase CLI found: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Firebase CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "   npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

# Deploy rules
Write-Host ""
Write-Host "📤 Deploying firestore.rules..." -ForegroundColor Yellow

firebase deploy --only firestore:rules

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ ✅ ✅ Firestore rules deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎯 Next Steps:" -ForegroundColor Cyan
    Write-Host "   1. Refresh your dashboard page" -ForegroundColor White
    Write-Host "   2. Check browser console for Firebase logs" -ForegroundColor White
    Write-Host "   3. You should see: '[Firebase] ✅ Dashboard stats: {...}'" -ForegroundColor White
    Write-Host ""
    Write-Host "📝 For troubleshooting, see: FIRESTORE_PERMISSIONS_FIX.md" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed. Check the error above." -ForegroundColor Red
    Write-Host "💡 Make sure you're logged in: firebase login" -ForegroundColor Yellow
}
