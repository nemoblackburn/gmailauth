// Paste this into the browser console on app.usetapestry.dev to test

console.log('=== MANUAL DEBUG TEST ===');

// Test 1: Check if extension content script is loaded
console.log('1. Checking for extension marker...');
const allInputs = document.querySelectorAll('input');
const hasExtensionMarker = Array.from(allInputs).some(input =>
  input.dataset.authAutofillAttached === 'true'
);
console.log('   Extension markers found:', hasExtensionMarker);

// Test 2: Find all input fields
console.log('\n2. All input fields on page:');
allInputs.forEach((input, i) => {
  console.log(`   Input ${i}:`, {
    type: input.type,
    maxLength: input.maxLength,
    size: input.size,
    id: input.id,
    name: input.name,
    class: input.className
  });
});

// Test 3: Check for single-digit pattern
console.log('\n3. Single-digit inputs:');
const singleDigitInputs = document.querySelectorAll('input[maxlength="1"], input[size="1"]');
console.log(`   Found ${singleDigitInputs.length} single-digit inputs`);

// Test 4: Check extension is installed
console.log('\n4. Checking if chrome.runtime is available...');
if (typeof chrome !== 'undefined' && chrome.runtime) {
  console.log('   ✓ Chrome runtime available');
  console.log('   Extension ID:', chrome.runtime.id);
} else {
  console.log('   ✗ Chrome runtime NOT available');
}

console.log('\n=== END DEBUG ===');
