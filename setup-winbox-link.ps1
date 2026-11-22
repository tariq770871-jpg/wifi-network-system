# ============================================================
#  setup-winbox-link.ps1  —  WiFi Network System
#  تسجيل رابط winbox:// مرة واحدة على جهازك
#  يتيح فتح Winbox بنقرة واحدة من زر «Winbox» في تبويب الأجهزة
#  يعمل بدون صلاحيات مدير (يسجل في سجل المستخدم الحالي فقط)
# ============================================================
$ErrorActionPreference = 'Stop'
Write-Host '=============================================='
Write-Host '  تسجيل رابط winbox:// لفتح Winbox من التطبيق'
Write-Host '=============================================='
Write-Host ''
Write-Host 'الخطوة 1/3: حدد مكان ملف winbox.exe على جهازك'
$wb = Read-Host 'اكتب المسار الكامل لملف winbox.exe (مثال: C:\Tools\winbox\winbox.exe)'
if ([string]::IsNullOrWhiteSpace($wb)) {
    Write-Host 'لم تدخل مساراً — تم الإلغاء.' -ForegroundColor Yellow
    exit 1
}
if (-not (Test-Path $wb)) {
    Write-Host 'المسار غير موجود — تأكد من مكان winbox.exe وأعد تشغيل السكربت.' -ForegroundColor Red
    Write-Host 'ملاحظة: حمّل Winbox من موقع MikroTik الرسمي: mikrotik.com/download'
    exit 1
}
$wb = (Resolve-Path $wb).Path

Write-Host 'الخطوة 2/3: إنشاء ملف التشغيل winbox-url.cmd'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$cmdFile = Join-Path $dir 'winbox-url.cmd'
# الملف يستقبل الرابط winbox://user@host أو winbox://host (أو MAC)
# ويستدعي winbox.exe بالصيغة الرسمية: winbox.exe <host> <user>
$cmdContent = @"
@echo off
setlocal
set "raw=%~1"
set "addr=%raw:winbox://=%"
set "addr=%addr:/=%"
if "%addr%"=="" exit /b
set "host="
set "user="
for /f "tokens=1,2 delims=@" %%a in ("%addr%") do (
  if "%%b"=="" (set "host=%%a") else (set "user=%%a" & set "host=%%b")
)
if "%host%"=="" exit /b
if not "%user%"=="" (
  start "" "$wb" "%host%" "%user%"
) else (
  start "" "$wb" "%host%"
)
"@
$cmdContent = $cmdContent -replace "`r`n", "`n" -replace "`n", "`r`n"
Set-Content -Path $cmdFile -Value $cmdContent -Encoding Default

Write-Host 'الخطوة 3/3: تسجيل winbox:// في سجل المستخدم الحالي'
$root = 'HKCU:\Software\Classes\winbox'
New-Item -Path $root -Force | Out-Null
Set-ItemProperty -Path $root -Name '(default)' -Value 'URL:Winbox Protocol'
New-ItemProperty -Path $root -Name 'URL Protocol' -PropertyType String -Value '' -Force | Out-Null
New-Item -Path "$root\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "$root\shell\open\command" -Name '(default)' -Value ('"{0}" "%1"' -f $cmdFile)

Write-Host ''
Write-Host 'تم التسجيل بنجاح!' -ForegroundColor Green
Write-Host ('  Winbox:      ' + $wb)
Write-Host ('  ملف التشغيل: ' + $cmdFile)
Write-Host ''
$try = Read-Host 'هل تريد تجربة الرابط الآن؟ اكتب عنوان راوتر (مثال: 192.168.88.1) أو اضغط Enter للخروج'
if (-not [string]::IsNullOrWhiteSpace($try)) {
    Start-Process ('winbox://' + $try.Trim())
}
Write-Host 'انتهى — من الآن زر «Winbox» في تبويب الأجهزة يفتح Winbox بنقرة واحدة.'
