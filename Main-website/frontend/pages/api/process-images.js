import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { set_numbers } = req.body;
    
    if (!set_numbers || !Array.isArray(set_numbers)) {
      return res.status(400).json({ error: 'Invalid set numbers' });
    }

    // Define paths
    const capturePath = path.join(process.cwd(), 'public', 'captures', 'eye_tracking_captures');
    const enhancePath = path.join(process.cwd(), 'public', 'captures', 'enhance');

    // Ensure enhance directory exists
    if (!fs.existsSync(enhancePath)) {
      fs.mkdirSync(enhancePath, { recursive: true });
    }

    const results = [];
    let processedCount = 0;

    // Process each set
    for (const setNumber of set_numbers) {
      try {
        // Process the files for this set
        await processSet(setNumber, capturePath, enhancePath);
        processedCount++;
        
        results.push({
          status: 'success',
          setNumber,
          message: `Processed set ${setNumber}`
        });
      } catch (error) {
        console.error(`Error processing set ${setNumber}:`, error);
        results.push({
          status: 'error',
          setNumber,
          message: `Error processing set ${setNumber}: ${error.message}`
        });
      }
    }

    // Return the results
    return res.status(200).json({
      success: true,
      processedCount,
      totalSets: set_numbers.length,
      results
    });

  } catch (error) {
    console.error('Error in process-images:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}

async function processSet(setNumber, capturePath, enhancePath) {
  // Process each file type for the set
  const fileTypes = ['webcam', 'screen', 'parameter'];
  
  for (const fileType of fileTypes) {
    const sourceFile = path.join(capturePath, `${fileType}_${setNumber}.${fileType === 'parameter' ? 'csv' : 'jpg'}`);
    const targetFile = path.join(enhancePath, `${fileType}_enhance_${setNumber}.${fileType === 'parameter' ? 'csv' : 'jpg'}`);

    if (fs.existsSync(sourceFile)) {
      // For now, just copy the file to the enhance directory
      // In a real implementation, you would process the image here
      fs.copyFileSync(sourceFile, targetFile);
    }
  }
} 