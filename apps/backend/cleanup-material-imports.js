const fs = require('fs');
const path = require('path');

// Files that need to be updated to use MaterialV2 instead of Material
const filesToUpdate = [
  'src/services/estimationService.js',
  'src/services/inventoryService.js', 
  'src/services/productService.js',
  'src/services/orderService.js',
  'src/services/cuttingOptimizationService.js',
  'src/services/reportService.js',
  'src/controllers/productController.js',
  'src/controllers/inventoryController.js',
  'src/controllers/orderController.js', 
  'src/controllers/accountingController.js',
  'src/utils/weightUtils.js',
  'src/utils/migrationToBatch.js'
];

// Files that can be deleted (test files and utilities for old schema)
const filesToDelete = [
  'check-materials.js',
  'test-material-with-schema.js',
  'test-controller-material-creation.js', 
  'test-new-material-creation.js',
  'src/models/Material.js'
];

function updateMaterialImports() {
  console.log('🔄 Starting Material import cleanup...');
  
  // Update imports in files
  filesToUpdate.forEach(filePath => {
    const fullPath = path.join(__dirname, filePath);
    
    if (fs.existsSync(fullPath)) {
      console.log(`📝 Updating ${filePath}...`);
      
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Replace Material import with MaterialV2
      content = content.replace(
        /const Material = require\(['"`]\.\.\/models\/Material['"`]\);?/g,
        "const MaterialV2 = require('../models/MaterialV2');"
      );
      
      // Replace Material references with MaterialV2 (be careful with variable names)
      content = content.replace(/\bMaterial\b/g, 'MaterialV2');
      
      // Fix any double replacements that might have occurred
      content = content.replace(/MaterialV2V2/g, 'MaterialV2');
      
      fs.writeFileSync(fullPath, content);
      console.log(`✅ Updated ${filePath}`);
    } else {
      console.log(`⚠️  File not found: ${filePath}`);
    }
  });
  
  // Delete old files
  console.log('\n🗑️  Removing old files...');
  filesToDelete.forEach(filePath => {
    const fullPath = path.join(__dirname, filePath);
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`✅ Deleted ${filePath}`);
    } else {
      console.log(`⚠️  File not found: ${filePath}`);
    }
  });
  
  console.log('\n🎉 Material import cleanup completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Run the database cleanup script: node cleanup-old-materials.js');
  console.log('2. Test the application to ensure everything works');
  console.log('3. Update frontend components if needed');
}

// Execute the cleanup
updateMaterialImports(); 