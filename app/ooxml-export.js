/* Manager Schedule Pro — browser + Node Office Open XML builder.
   STORE-method ZIP (no compression). No server, no Node-only APIs in the
   download path. Word (.docx) and Excel (.xlsx) share this zip layer. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MSB_OOXML = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  const CRC_TABLE = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    CRC_TABLE[i] = c >>> 0;
  }

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function utf8(str) {
    return new TextEncoder().encode(String(str == null ? '' : str));
  }

  function xmlEscape(s) {
    return String(s == null ? '' : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function hex6(c) {
    const s = String(c || '').replace('#', '').toUpperCase();
    return /^[0-9A-F]{6}$/.test(s) ? s : 'FFFFFF';
  }

  function argb(c) {
    return 'FF' + hex6(c);
  }

  function dosDateTime(d) {
    const dt = d instanceof Date ? d : new Date();
    const time = (dt.getHours() << 11) | (dt.getMinutes() << 5) | ((dt.getSeconds() >> 1) & 31);
    const date = ((dt.getFullYear() - 1980) << 9) | ((dt.getMonth() + 1) << 5) | dt.getDate();
    return { time: time & 0xFFFF, date: date & 0xFFFF };
  }

  function concatBytes(parts) {
    let n = 0;
    for (let i = 0; i < parts.length; i++) n += parts[i].length;
    const out = new Uint8Array(n);
    let off = 0;
    for (let i = 0; i < parts.length; i++) {
      out.set(parts[i], off);
      off += parts[i].length;
    }
    return out;
  }

  function zipStore(files, stamped) {
    const stamp = dosDateTime(stamped);
    const locals = [];
    const centrals = [];
    let offset = 0;
    const names = Object.keys(files);
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const raw = files[name];
      const data = raw instanceof Uint8Array ? raw : utf8(raw);
      const nameBytes = utf8(name);
      const crc = crc32(data);
      const local = new Uint8Array(30 + nameBytes.length + data.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, stamp.time, true);
      lv.setUint16(12, stamp.date, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);
      local.set(data, 30 + nameBytes.length);
      locals.push(local);

      const central = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, stamp.time, true);
      cv.setUint16(14, stamp.date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      central.set(nameBytes, 46);
      centrals.push(central);
      offset += local.length;
    }
    const cdStart = offset;
    let cdSize = 0;
    for (let i = 0; i < centrals.length; i++) cdSize += centrals[i].length;
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, names.length, true);
    ev.setUint16(10, names.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, cdStart, true);
    ev.setUint16(20, 0, true);
    return concatBytes(locals.concat(centrals, [eocd]));
  }

  function unzipStore(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= 0; i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error('OOXML zip: EOCD not found');
    const count = view.getUint16(eocd + 10, true);
    let cd = view.getUint32(eocd + 16, true);
    const files = {};
    const dec = new TextDecoder();
    for (let n = 0; n < count; n++) {
      if (view.getUint32(cd, true) !== 0x02014b50) throw new Error('OOXML zip: bad central directory');
      const method = view.getUint16(cd + 10, true);
      const crc = view.getUint32(cd + 16, true);
      const comp = view.getUint32(cd + 20, true);
      const nameLen = view.getUint16(cd + 28, true);
      const extraLen = view.getUint16(cd + 30, true);
      const commentLen = view.getUint16(cd + 32, true);
      const localOff = view.getUint32(cd + 42, true);
      const name = dec.decode(u8.subarray(cd + 46, cd + 46 + nameLen));
      const localNameLen = view.getUint16(localOff + 26, true);
      const localExtra = view.getUint16(localOff + 28, true);
      const dataStart = localOff + 30 + localNameLen + localExtra;
      const data = u8.subarray(dataStart, dataStart + comp);
      if (method !== 0) throw new Error('OOXML zip: expected STORE, got method ' + method);
      files[name] = { bytes: data, crc: crc, text: dec.decode(data) };
      cd += 46 + nameLen + extraLen + commentLen;
    }
    return files;
  }

  function isoNow(d) {
    const dt = d instanceof Date ? d : new Date();
    return dt.toISOString().replace(/\.\d+Z$/, 'Z');
  }

  function coreXml(title, created) {
    const when = isoNow(created);
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"' +
      ' xmlns:dc="http://purl.org/dc/elements/1.1/"' +
      ' xmlns:dcterms="http://purl.org/dc/terms/"' +
      ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + xmlEscape(title || 'Management Schedule') + '</dc:title>' +
      '<dc:creator>Manager Schedule Pro</dc:creator>' +
      '<cp:lastModifiedBy>Manager Schedule Pro</cp:lastModifiedBy>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + when + '</dcterms:created>' +
      '<dcterms:modified xsi:type="dcterms:W3CDTF">' + when + '</dcterms:modified>' +
      '</cp:coreProperties>';
  }

  function appXml(appName) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">' +
      '<Application>' + xmlEscape(appName || 'Manager Schedule Pro') + '</Application>' +
      '</Properties>';
  }

  function wText(text, opts) {
    opts = opts || {};
    const raw = String(text == null ? '' : text);
    const space = /^\s|\s$/.test(raw) ? ' xml:space="preserve"' : '';
    let rPr = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>';
    if (opts.bold) rPr += '<w:b/><w:bCs/>';
    if (opts.sz) rPr += '<w:sz w:val="' + opts.sz + '"/><w:szCs w:val="' + opts.sz + '"/>';
    if (opts.color) rPr += '<w:color w:val="' + hex6(opts.color) + '"/>';
    return '<w:r><w:rPr>' + rPr + '</w:rPr><w:t' + space + '>' + xmlEscape(raw) + '</w:t></w:r>';
  }

  function wP(runs, opts) {
    opts = opts || {};
    let pPr = '';
    if (opts.jc) pPr += '<w:jc w:val="' + opts.jc + '"/>';
    if (opts.shd) pPr += '<w:shd w:val="clear" w:color="auto" w:fill="' + hex6(opts.shd) + '"/>';
    if (opts.after != null) pPr += '<w:spacing w:after="' + opts.after + '"/>';
    if (opts.borders) {
      pPr += '<w:pBdr>' +
        '<w:top w:val="single" w:sz="12" w:space="1" w:color="111111"/>' +
        '<w:left w:val="single" w:sz="12" w:space="1" w:color="111111"/>' +
        '<w:bottom w:val="single" w:sz="12" w:space="1" w:color="111111"/>' +
        '<w:right w:val="single" w:sz="12" w:space="1" w:color="111111"/>' +
        '</w:pBdr>';
    }
    return '<w:p>' + (pPr ? '<w:pPr>' + pPr + '</w:pPr>' : '') + (runs || '') + '</w:p>';
  }

  function wTc(runs, opts) {
    opts = opts || {};
    let tcPr = '<w:tcW w:w="' + (opts.w || 1714) + '" w:type="dxa"/>';
    if (opts.span) tcPr += '<w:gridSpan w:val="' + opts.span + '"/>';
    if (opts.fill) tcPr += '<w:shd w:val="clear" w:color="auto" w:fill="' + hex6(opts.fill) + '"/>';
    tcPr += '<w:tcBorders>' +
      '<w:top w:val="single" w:sz="4" w:space="0" w:color="333333"/>' +
      '<w:left w:val="single" w:sz="4" w:space="0" w:color="333333"/>' +
      '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="333333"/>' +
      '<w:right w:val="single" w:sz="4" w:space="0" w:color="333333"/>' +
      '</w:tcBorders><w:vAlign w:val="center"/>';
    const p = wP(runs || wText(''), { jc: opts.jc || 'center' });
    return '<w:tc><w:tcPr>' + tcPr + '</w:tcPr>' + p + '</w:tc>';
  }

  function wordStyles() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr>' +
      '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>' +
      '<w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="111111"/>' +
      '</w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:before="0"/></w:pPr></w:pPrDefault>' +
      '</w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
      '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/>' +
      '<w:semiHidden/><w:unhideWhenUsed/></w:style>' +
      '</w:styles>';
  }

  function wordSettings() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:view w:val="print"/><w:zoom w:percent="100"/>' +
      '<w:compat><w:compatSetting w:name="compatibilityMode"' +
      ' w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>' +
      '</w:settings>';
  }

  function buildWordDocumentXml(model) {
    const m = model || {};
    const nameW = 2400;
    const dayW = 1714;
    let body = '';
    body += wP(wText(m.title || 'MANAGEMENT SCHEDULE', { bold: true, sz: 32 }), { jc: 'center', after: 80 });
    if (m.subtitle) body += wP(wText(m.subtitle, { sz: 22 }), { jc: 'center', after: 80 });
    // Readiness / NOT READY is UI-only — never write it into .docx bytes.
    const legend = m.legend || [];
    if (legend.length) {
      let runs = '';
      legend.forEach((item, i) => {
        if (i) runs += wText('   ', { sz: 16 });
        runs += wText(' ' + (item.label || '') + ' ', { sz: 16, bold: true, color: '#111111' });
      });
      body += wP(runs, { jc: 'center', after: 200 });
    }

    const weeks = m.weeks || [];
    weeks.forEach((week) => {
      const grid = '<w:tblGrid><w:gridCol w:w="' + nameW + '"/>' +
        new Array(7).fill('<w:gridCol w:w="' + dayW + '"/>').join('') + '</w:tblGrid>';
      let rows = '';
      rows += '<w:tr>' + wTc(
        wText(week.wordBanner || week.excelBanner || '', { bold: true, sz: 20, color: '#FFFFFF' }),
        { span: 8, fill: '#1A1A2E', w: nameW + dayW * 7, jc: 'left' }
      ) + '</w:tr>';

      let hdr = '<w:tr>' + wTc(wText(m.nameHeader || 'Name', { bold: true, sz: 18 }), { fill: '#F3F4F6', w: nameW, jc: 'left' });
      (m.dayHeaders || ['SUN', 'MON', 'TUES', 'WED', 'THURS', 'FRI', 'SAT']).forEach((dn) => {
        hdr += wTc(wText(dn, { bold: true, sz: 18 }), { fill: '#F3F4F6', w: dayW });
      });
      rows += hdr + '</w:tr>';

      let dates = '<w:tr>' + wTc(wText(''), { fill: '#F3F4F6', w: nameW });
      (week.dates || []).forEach((n) => {
        dates += wTc(wText(String(n), { bold: true, sz: 18 }), { fill: '#F3F4F6', w: dayW });
      });
      rows += dates + '</w:tr>';

      (week.rows || []).forEach((row) => {
        let tr = '<w:tr>' + wTc(wText(row.name || '', { bold: true, sz: 18 }), { fill: '#F8F9FB', w: nameW, jc: 'left' });
        (row.cells || []).forEach((cell) => {
          tr += wTc(
            wText(cell.label || '', { bold: true, sz: 18, color: cell.color || '#111111' }),
            { fill: cell.bg || '#FFFFFF', w: dayW }
          );
        });
        rows += tr + '</w:tr>';
      });

      body += '<w:tbl><w:tblPr>' +
        '<w:tblW w:w="5000" w:type="pct"/>' +
        '<w:tblLayout w:type="fixed"/>' +
        '</w:tblPr>' + grid + rows + '</w:tbl>';
      body += wP(wText(''), { after: 200 });
    });

    body += '<w:sectPr>' +
      '<w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/>' +
      '<w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="0" w:footer="0"/>' +
      '</w:sectPr>';

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' + body + '</w:body></w:document>';
  }

  function buildDocx(model, stamped) {
    const files = {
      '[Content_Types].xml':
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
        '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
        '</Types>',
      '_rels/.rels':
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
        '</Relationships>',
      'word/_rels/document.xml.rels':
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
        '</Relationships>',
      'word/document.xml': buildWordDocumentXml(model),
      'word/styles.xml': wordStyles(),
      'word/settings.xml': wordSettings(),
      'docProps/core.xml': coreXml((model && model.title) || 'Management Schedule', stamped),
      'docProps/app.xml': appXml('Manager Schedule Pro')
    };
    return zipStore(files, stamped);
  }

  function colLetter(n) {
    let s = '';
    let x = n + 1;
    while (x > 0) {
      const m = (x - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      x = Math.floor((x - 1) / 26);
    }
    return s;
  }

  function StyleBook() {
    this.fonts = [
      { sz: 11, color: 'FF000000', bold: false },
      { sz: 16, color: 'FF111111', bold: true },
      { sz: 11, color: 'FF111111', bold: false },
      { sz: 10, color: 'FF111111', bold: true },
      { sz: 10, color: 'FFFFFFFF', bold: true },
      { sz: 9, color: 'FF111111', bold: true }
    ];
    this.fills = [
      { pattern: 'none' },
      { pattern: 'gray125' },
      { rgb: 'FFF3F4F6' },
      { rgb: 'FFF8F9FB' },
      { rgb: 'FF1A1A2E' },
      { rgb: 'FFFFF3CD' }
    ];
    this.xfs = [{ font: 0, fill: 0, border: 0, align: 'left' }];
    this.xfMap = { '0|0|0|left': 0 };
  }

  StyleBook.prototype.fontId = function (opts) {
    opts = opts || {};
    const sz = opts.sz || 9;
    const color = opts.color ? argb(opts.color) : 'FF111111';
    const bold = !!opts.bold;
    for (let i = 0; i < this.fonts.length; i++) {
      const f = this.fonts[i];
      if (f.sz === sz && f.color === color && f.bold === bold) return i;
    }
    this.fonts.push({ sz: sz, color: color, bold: bold });
    return this.fonts.length - 1;
  };

  StyleBook.prototype.fillId = function (hex) {
    if (!hex) return 0;
    const rgb = argb(hex);
    for (let i = 0; i < this.fills.length; i++) {
      if (this.fills[i].rgb === rgb) return i;
    }
    this.fills.push({ rgb: rgb });
    return this.fills.length - 1;
  };

  StyleBook.prototype.xf = function (font, fill, align, border) {
    const b = border == null ? 1 : border;
    const key = font + '|' + fill + '|' + b + '|' + align;
    if (this.xfMap[key] != null) return this.xfMap[key];
    const id = this.xfs.length;
    this.xfs.push({ font: font, fill: fill, border: b, align: align });
    this.xfMap[key] = id;
    return id;
  };

  StyleBook.prototype.stylesXml = function () {
    let fonts = '';
    this.fonts.forEach((f) => {
      fonts += '<font>' + (f.bold ? '<b/>' : '') +
        '<sz val="' + f.sz + '"/><color rgb="' + f.color + '"/>' +
        '<name val="Arial"/><family val="2"/></font>';
    });
    let fills = '';
    this.fills.forEach((f) => {
      if (f.pattern === 'none') fills += '<fill><patternFill patternType="none"/></fill>';
      else if (f.pattern === 'gray125') fills += '<fill><patternFill patternType="gray125"/></fill>';
      else fills += '<fill><patternFill patternType="solid"><fgColor rgb="' + f.rgb + '"/><bgColor indexed="64"/></patternFill></fill>';
    });
    let xfs = '';
    this.xfs.forEach((x) => {
      xfs += '<xf numFmtId="0" fontId="' + x.font + '" fillId="' + x.fill +
        '" borderId="' + x.border + '" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
        '<alignment horizontal="' + x.align + '" vertical="center" wrapText="1"/></xf>';
    });
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="' + this.fonts.length + '">' + fonts + '</fonts>' +
      '<fills count="' + this.fills.length + '">' + fills + '</fills>' +
      '<borders count="2">' +
      '<border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border>' +
      '<left style="thin"><color rgb="FF333333"/></left>' +
      '<right style="thin"><color rgb="FF333333"/></right>' +
      '<top style="thin"><color rgb="FF333333"/></top>' +
      '<bottom style="thin"><color rgb="FF333333"/></bottom>' +
      '<diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + this.xfs.length + '">' + xfs + '</cellXfs>' +
      '</styleSheet>';
  };

  function inlineCell(ref, text, style) {
    return '<c r="' + ref + '" t="inlineStr" s="' + style + '"><is><t>' + xmlEscape(text == null ? '' : text) + '</t></is></c>';
  }

  function buildSheetXml(model) {
    const m = model || {};
    const styles = new StyleBook();
    const titleXf = styles.xf(1, 0, 'left', 0);
    const subXf = styles.xf(2, 0, 'left', 0);
    const bannerXf = styles.xf(4, 4, 'left', 1);
    const headXf = styles.xf(5, 2, 'center', 1);
    const nameXf = styles.xf(5, 3, 'left', 1);
    const rows = [];
    let r = 1;
    rows.push({ r: r, cells: [inlineCell('A' + r, m.title || 'MANAGEMENT SCHEDULE', titleXf)] });
    r += 1;
    if (m.excelSubtitle || m.subtitle) {
      rows.push({ r: r, cells: [inlineCell('A' + r, m.excelSubtitle || m.subtitle, subXf)] });
      r += 1;
    }
    // Readiness / NOT READY is UI-only — never write it into .xlsx bytes.
    r += 1;
    const days = m.dayHeaders || ['SUN', 'MON', 'TUES', 'WED', 'THURS', 'FRI', 'SAT'];
    (m.weeks || []).forEach((week) => {
      rows.push({ r: r, cells: [inlineCell('A' + r, week.excelBanner || week.wordBanner || '', bannerXf)] });
      r += 1;
      const hdr = [inlineCell('A' + r, '', headXf)];
      days.forEach((dn, i) => { hdr.push(inlineCell(colLetter(i + 1) + r, dn, headXf)); });
      rows.push({ r: r, cells: hdr });
      r += 1;
      const dateRow = [inlineCell('A' + r, '', headXf)];
      (week.dates || []).forEach((n, i) => { dateRow.push(inlineCell(colLetter(i + 1) + r, String(n), headXf)); });
      rows.push({ r: r, cells: dateRow });
      r += 1;
      (week.rows || []).forEach((row) => {
        const cells = [inlineCell('A' + r, row.name || '', nameXf)];
        (row.cells || []).forEach((cell, i) => {
          const font = styles.fontId({ sz: 9, bold: true, color: cell.color || '#111111' });
          const fill = styles.fillId(cell.bg || '#FFFFFF');
          const xf = styles.xf(font, fill, 'center', 1);
          cells.push(inlineCell(colLetter(i + 1) + r, cell.label || '', xf));
        });
        rows.push({ r: r, cells: cells });
        r += 1;
      });
      r += 1;
    });
    const lastRow = Math.max(1, r - 1);
    let sheetData = '';
    rows.forEach((row) => {
      sheetData += '<row r="' + row.r + '">' + row.cells.join('') + '</row>';
    });
    const cols = '<cols>' +
      '<col min="1" max="1" width="22" customWidth="1"/>' +
      '<col min="2" max="8" width="12" customWidth="1"/>' +
      '</cols>';
    const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
      ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheetPr/><dimension ref="A1:H' + lastRow + '"/>' +
      '<sheetViews><sheetView workbookViewId="0"/></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="16"/>' + cols +
      '<sheetData>' + sheetData + '</sheetData>' +
      '<pageSetup paperSize="1" orientation="landscape"/>' +
      '</worksheet>';
    return { xml: xml, stylesXml: styles.stylesXml() };
  }

  function buildXlsx(model, stamped) {
    const sheet = buildSheetXml(model);
    const files = {
      '[Content_Types].xml':
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
        '</Types>',
      '_rels/.rels':
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
        '</Relationships>',
      'xl/workbook.xml':
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
        ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Schedule" sheetId="1" r:id="rId1"/></sheets>' +
        '</workbook>',
      'xl/_rels/workbook.xml.rels':
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>',
      'xl/worksheets/sheet1.xml': sheet.xml,
      'xl/styles.xml': sheet.stylesXml,
      'docProps/core.xml': coreXml((model && model.title) || 'Management Schedule', stamped),
      'docProps/app.xml': appXml('Manager Schedule Pro')
    };
    return zipStore(files, stamped);
  }

  return {
    MIME_DOCX: MIME_DOCX,
    MIME_XLSX: MIME_XLSX,
    xmlEscape: xmlEscape,
    zipStore: zipStore,
    unzipStore: unzipStore,
    buildDocx: buildDocx,
    buildXlsx: buildXlsx
  };
});
