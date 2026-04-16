import express from 'express';
import multer from 'multer';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);
const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/scan', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const targetPath = req.file.path;
  console.log(`[VM-Scanner] Scanning: ${req.file.originalname}`);

  try {
    const { stdout } = await execAsync(`grype ${targetPath} -o json -q`);
    const results = JSON.parse(stdout);
    
    const vulnerabilities = (results.matches || []).map((match: any) => ({
      id: match.vulnerability.id,
      cve_id: match.vulnerability.id.startsWith('CVE') ? match.vulnerability.id : undefined,
      severity: match.vulnerability.severity.toUpperCase(),
      cvss_score: match.vulnerability.cvss?.[0]?.metrics?.baseScore || 0,
      title: `${match.vulnerability.id} in ${match.artifact.name}`,
      description: `Found in ${match.artifact.name}@${match.artifact.version}`,
      affected_components: [`${match.artifact.name}@${match.artifact.version}`],
      source: 'free'
    }));

    res.json({ vulnerabilities });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    // Cleanup
    fs.unlinkSync(targetPath);
  }
});

const PORT = 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Scanner Agent running on port ${PORT}`);
});
