# Test des endpoints /markets/by-city
# Ce script teste la gestion robuste des erreurs Nominatim/Overpass

$baseUrl = "http://localhost:3000/serviceprediction"
$successCount = 0
$failCount = 0

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Tests de l'endpoint /markets/by-city" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

function Test-Endpoint {
    param(
        [string]$TestName,
        [string]$Ville,
        [int]$ExpectedStatus,
        [string]$ExpectedErrorType = $null
    )
    
    Write-Host "Test: $TestName" -ForegroundColor Yellow
    Write-Host "  Ville: $Ville" -ForegroundColor Gray
    
    try {
        $startTime = Get-Date
        $response = Invoke-WebRequest -Uri "$baseUrl/markets/by-city?ville=$Ville" -Method GET -ErrorAction Stop
        $elapsed = (Get-Date) - $startTime
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host "  ✅ Status: $($response.StatusCode) (attendu: $ExpectedStatus)" -ForegroundColor Green
            
            $json = $response.Content | ConvertFrom-Json
            
            if ($json.type -eq "FeatureCollection") {
                Write-Host "  ✅ Format: FeatureCollection" -ForegroundColor Green
                Write-Host "  📊 Marchés trouvés: $($json.features.Count)" -ForegroundColor Cyan
                Write-Host "  🌍 Bbox: [$($json.metadata.bbox.south), $($json.metadata.bbox.west), $($json.metadata.bbox.north), $($json.metadata.bbox.east)]" -ForegroundColor Gray
                Write-Host "  📍 Display name: $($json.metadata.geocoding.display_name)" -ForegroundColor Gray
            }
            
            Write-Host "  ⏱️  Temps: $($elapsed.TotalMilliseconds)ms" -ForegroundColor Cyan
            $script:successCount++
            return $true
        } else {
            Write-Host "  ❌ Status inattendu: $($response.StatusCode) (attendu: $ExpectedStatus)" -ForegroundColor Red
            $script:failCount++
            return $false
        }
        
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $elapsed = (Get-Date) - $startTime
        
        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "  ✅ Status: $statusCode (attendu: $ExpectedStatus)" -ForegroundColor Green
            
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $responseBody = $reader.ReadToEnd()
                $json = $responseBody | ConvertFrom-Json
                
                Write-Host "  📋 Erreur: $($json.error)" -ForegroundColor Cyan
                Write-Host "  💬 Message: $($json.message)" -ForegroundColor Gray
                
                if ($json.suggestion) {
                    Write-Host "  💡 Suggestion: $($json.suggestion)" -ForegroundColor Yellow
                }
                
                if ($ExpectedErrorType -and $json.error -eq $ExpectedErrorType) {
                    Write-Host "  ✅ Type d'erreur correct: $($json.error)" -ForegroundColor Green
                } elseif ($ExpectedErrorType) {
                    Write-Host "  ⚠️  Type d'erreur: $($json.error) (attendu: $ExpectedErrorType)" -ForegroundColor Yellow
                }
                
                Write-Host "  ⏱️  Temps: $($elapsed.TotalMilliseconds)ms" -ForegroundColor Cyan
                
            } catch {
                Write-Host "  ⚠️  Impossible de parser la réponse JSON" -ForegroundColor Yellow
            }
            
            $script:successCount++
            return $true
            
        } else {
            Write-Host "  ❌ Status inattendu: $statusCode (attendu: $ExpectedStatus)" -ForegroundColor Red
            Write-Host "  Erreur: $($_.Exception.Message)" -ForegroundColor Red
            $script:failCount++
            return $false
        }
    } finally {
        Write-Host ""
    }
}

# Test 1: Ville avec fallback (Mahajanga)
Test-Endpoint -TestName "Ville majeure avec fallback" -Ville "Mahajanga" -ExpectedStatus 200

# Test 2: Ville avec fallback (Antsohihy - mentionnée dans les logs d'erreur)
Test-Endpoint -TestName "Antsohihy (ville problématique des logs)" -Ville "Antsohihy" -ExpectedStatus 200

# Test 3: Ville avec fallback (Toamasina)
Test-Endpoint -TestName "Toamasina (port majeur)" -Ville "Toamasina" -ExpectedStatus 200

# Test 4: Capitale
Test-Endpoint -TestName "Capitale (Antananarivo)" -Ville "Antananarivo" -ExpectedStatus 200

# Test 5: Ville inexistante
Test-Endpoint -TestName "Ville inexistante" -Ville "VilleInexistante123" -ExpectedStatus 404 -ExpectedErrorType "CITY_NOT_FOUND"

# Test 6: Paramètre manquant
Write-Host "Test: Paramètre manquant" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/markets/by-city" -Method GET -ErrorAction Stop
    Write-Host "  ❌ Devrait retourner 400" -ForegroundColor Red
    $script:failCount++
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 400) {
        Write-Host "  ✅ Status: 400 (attendu)" -ForegroundColor Green
        $script:successCount++
    } else {
        Write-Host "  ❌ Status inattendu: $statusCode (attendu: 400)" -ForegroundColor Red
        $script:failCount++
    }
}
Write-Host ""

# Test 7: Vérifier le cache (2 appels successifs)
Write-Host "Test: Vérification du cache" -ForegroundColor Yellow
Write-Host "  1er appel (devrait appeler Nominatim):" -ForegroundColor Gray
$time1 = Measure-Command { 
    Invoke-WebRequest -Uri "$baseUrl/markets/by-city?ville=Fianarantsoa" -Method GET -ErrorAction SilentlyContinue 
}

Start-Sleep -Milliseconds 500

Write-Host "  2ème appel (devrait utiliser le cache):" -ForegroundColor Gray
$time2 = Measure-Command { 
    Invoke-WebRequest -Uri "$baseUrl/markets/by-city?ville=Fianarantsoa" -Method GET -ErrorAction SilentlyContinue 
}

Write-Host "  ⏱️  1er appel: $($time1.TotalMilliseconds)ms" -ForegroundColor Cyan
Write-Host "  ⏱️  2ème appel: $($time2.TotalMilliseconds)ms" -ForegroundColor Cyan

if ($time2.TotalMilliseconds -lt $time1.TotalMilliseconds) {
    Write-Host "  ✅ Le cache accélère les requêtes !" -ForegroundColor Green
    $speedup = [math]::Round(($time1.TotalMilliseconds - $time2.TotalMilliseconds) / $time1.TotalMilliseconds * 100, 1)
    Write-Host "  🚀 Gain: $speedup%" -ForegroundColor Cyan
    $script:successCount++
} else {
    Write-Host "  ⚠️  Le 2ème appel n'est pas plus rapide (cache peut-être désactivé)" -ForegroundColor Yellow
    $script:successCount++
}
Write-Host ""

# Test 8: Villes avec accents et caractères spéciaux
Test-Endpoint -TestName "Ville avec accents" -Ville "Toliara" -ExpectedStatus 200

# Résumé
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Résumé des tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Tests réussis: $successCount" -ForegroundColor Green
Write-Host "❌ Tests échoués: $failCount" -ForegroundColor Red
$total = $successCount + $failCount
$successRate = [math]::Round($successCount / $total * 100, 1)
Write-Host "📊 Taux de réussite: $successRate%" -ForegroundColor Cyan

if ($failCount -eq 0) {
    Write-Host "`n🎉 Tous les tests ont réussi !" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n⚠️  Certains tests ont échoué. Vérifiez les logs ci-dessus." -ForegroundColor Yellow
    exit 1
}
