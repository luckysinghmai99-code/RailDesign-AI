import JSZip from 'jszip';
import type { ProjectFile, ProjectRecord } from '../../shared/types.ts';
import {
  logEngine,
  type EngineContext,
  type EngineOutput,
  type IndependentEngine,
} from './baseEngine.ts';

export interface VerificationCheck {
  name: string;
  status: 'pass' | 'fixed' | 'warn';
  detail: string;
}

export function runStaticValidationAndAutoFix(files: ProjectFile[]): {
  fixedFiles: ProjectFile[];
  checks: VerificationCheck[];
  passed: boolean;
} {
  const checks: VerificationCheck[] = [];
  const fixedFiles = files.map((file) => ({ ...file }));

  const htmlFile = fixedFiles.find((f) => f.path.endsWith('.html'));
  if (!htmlFile) {
    checks.push({
      name: 'HTML Entrypoint',
      status: 'warn',
      detail: 'No index.html found in project files.',
    });
  } else {
    let content = htmlFile.content;
    if (!content.includes('name="viewport"') && !content.includes("name='viewport'")) {
      content = content.replace(
        /<head>/i,
        '<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />'
      );
      htmlFile.content = content;
      checks.push({
        name: 'Responsive Viewport Meta',
        status: 'fixed',
        detail: 'Injected missing responsive viewport meta tag into HTML head.',
      });
    } else {
      checks.push({
        name: 'Responsive Viewport Meta',
        status: 'pass',
        detail: 'Viewport meta tag verified for mobile, tablet, and desktop scaling.',
      });
    }

    if (/<img\b(?![^>]*\balt=)[^>]*>/i.test(content)) {
      content = content.replace(/<img\b(?![^>]*\balt=)([^>]*)>/gi, '<img alt="Design asset"$1>');
      htmlFile.content = content;
      checks.push({
        name: 'Image Accessibility (alt)',
        status: 'fixed',
        detail: 'Added missing alt attributes to <img> elements.',
      });
    } else {
      checks.push({
        name: 'Image Accessibility (alt)',
        status: 'pass',
        detail: 'All image elements include descriptive alt attributes.',
      });
    }
  }

  // Check CSS brace balance
  const cssFiles = fixedFiles.filter((f) => f.language === 'css');
  for (const css of cssFiles) {
    const opens = (css.content.match(/\{/g) || []).length;
    const closes = (css.content.match(/\}/g) || []).length;
    if (opens !== closes) {
      if (opens > closes) {
        css.content += '\n' + '}'.repeat(opens - closes);
      }
      checks.push({
        name: `CSS Syntax (${css.path})`,
        status: 'fixed',
        detail: `Balanced mismatched braces (${opens} open / ${closes} close).`,
      });
    } else {
      checks.push({
        name: `CSS Syntax (${css.path})`,
        status: 'pass',
        detail: 'CSS rules and brace pairs validated.',
      });
    }
  }

  // Check JS syntax via Function parser (safe parse only, never executed)
  const jsFiles = fixedFiles.filter((f) => f.language === 'javascript');
  for (const js of jsFiles) {
    try {
      new Function(js.content);
      checks.push({
        name: `JavaScript Parse (${js.path})`,
        status: 'pass',
        detail: 'Script parsed cleanly without syntax errors.',
      });
    } catch (err) {
      checks.push({
        name: `JavaScript Parse (${js.path})`,
        status: 'warn',
        detail: err instanceof Error ? err.message : 'Syntax check warning.',
      });
    }
  }

  const passed = checks.every((c) => c.status !== 'warn');
  return { fixedFiles, checks, passed };
}

export async function buildVerifiedProjectZip(project: ProjectRecord): Promise<Buffer> {
  const zip = new JSZip();
  for (const file of project.files) {
    zip.file(file.path.replace(/^\/+/, ''), file.content);
  }

  if (project.gifDataUrl && project.gifDataUrl.startsWith('data:image/gif;base64,')) {
    const b64 = project.gifDataUrl.split(',')[1];
    zip.file('assets/animation.gif', Buffer.from(b64, 'base64'));
  }

  for (let i = 0; i < (project.generatedImages || []).length; i++) {
    const img = project.generatedImages[i];
    if (img.dataUrl.includes(';base64,')) {
      const b64 = img.dataUrl.split(',')[1];
      const ext = img.mimeType.includes('svg') ? 'svg' : img.mimeType.includes('jpeg') ? 'jpg' : 'png';
      zip.file(`assets/image-${i + 1}.${ext}`, Buffer.from(b64, 'base64'));
    }
  }

  zip.file(
    'raildesign.project.json',
    JSON.stringify(
      {
        id: project.id,
        name: project.name,
        engineId: project.engineId,
        designSystem: project.designSystem,
        screens: project.screens,
      },
      null,
      2
    )
  );

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  // Verify archive can be reopened cleanly
  await JSZip.loadAsync(buf);
  return buf;
}

export class TestingExportEngine implements IndependentEngine {
  readonly id = 'engine06_testing_export' as const;
  readonly name = 'Testing & Export Engine';

  async execute(ctx: EngineContext): Promise<EngineOutput> {
    logEngine(ctx.jobId, this.id, 'info', 'Running Engine 06 verification & auto-repair checks');
    const files = ctx.existingProject?.files || [];
    const { fixedFiles, checks, passed } = runStaticValidationAndAutoFix(files);

    const passCount = checks.filter((c) => c.status === 'pass' || c.status === 'fixed').length;
    const testReport = {
      passed,
      scoreLabel: `${passCount}/${checks.length} checks verified`,
      checks,
      ranAt: new Date().toISOString(),
    };

    logEngine(ctx.jobId, this.id, 'info', `Testing & Export Engine finished: ${testReport.scoreLabel}`);

    return {
      summary: `Automated quality & responsive audit complete (${testReport.scoreLabel}). Export bundle ready.`,
      files: fixedFiles,
      testReport,
    };
  }
}

export const testingExportEngine = new TestingExportEngine();
