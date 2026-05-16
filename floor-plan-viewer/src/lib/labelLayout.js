import { layoutWithLines, measureLineStats, prepareWithSegments } from "@chenglou/pretext";

const NAME_FONT = '600 13px "Segoe UI", Arial, sans-serif';
const SMALL_NAME_FONT = '600 11px "Segoe UI", Arial, sans-serif';
const DIMS_FONT = '400 10px "Segoe UI", Arial, sans-serif';
const SMALL_DIMS_FONT = '400 9px "Segoe UI", Arial, sans-serif';
const NAME_LINE_HEIGHT = 16;
const SMALL_NAME_LINE_HEIGHT = 14;
const DIMS_LINE_HEIGHT = 13;
const SMALL_DIMS_LINE_HEIGHT = 12;
const PADDING_X = 10;
const PADDING_Y = 6;
const MIN_PILL_WIDTH = 48;

function textLines(text, font, maxWidthPx, lineHeight, kind) {
  const value = String(text || "").trim();
  if (!value) return [];
  const prepared = prepareWithSegments(value, font);
  return layoutWithLines(prepared, maxWidthPx, lineHeight).lines.map(function (line) {
    return {
      text: line.text,
      width: line.width,
      lineHeight: lineHeight,
      kind: kind,
    };
  });
}

function layoutWithFonts(name, dims, maxWidthPx, compact) {
  const nameFont = compact ? SMALL_NAME_FONT : NAME_FONT;
  const dimsFont = compact ? SMALL_DIMS_FONT : DIMS_FONT;
  const nameLineHeight = compact ? SMALL_NAME_LINE_HEIGHT : NAME_LINE_HEIGHT;
  const dimsLineHeight = compact ? SMALL_DIMS_LINE_HEIGHT : DIMS_LINE_HEIGHT;
  const innerWidth = Math.max(16, maxWidthPx - PADDING_X * 2);
  const nameLines = textLines(name, nameFont, innerWidth, nameLineHeight, "name");
  const dimsLines = textLines(dims, dimsFont, innerWidth, dimsLineHeight, "dims");
  const lines = nameLines.concat(dimsLines);
  const maxLineWidth = lines.reduce(function (max, line) {
    return Math.max(max, line.width);
  }, 0);
  const textHeight = lines.reduce(function (sum, line) {
    return sum + line.lineHeight;
  }, 0);

  return {
    lines: lines,
    pillWidth: Math.min(maxWidthPx, Math.max(MIN_PILL_WIDTH, Math.ceil(maxLineWidth + PADDING_X * 2))),
    pillHeight: Math.ceil(textHeight + PADDING_Y * 2),
    paddingY: PADDING_Y,
    nameFontSize: compact ? 11 : 13,
    dimsFontSize: compact ? 9 : 10,
  };
}

export function layoutRoomLabel(options) {
  const name = options.name || "Room";
  const dims = options.dims || "";
  const maxWidthPx = Math.max(MIN_PILL_WIDTH, options.maxWidthPx || 120);
  const maxHeightPx = options.maxHeightPx || Infinity;
  let layout = layoutWithFonts(name, dims, maxWidthPx, false);
  if (layout.pillHeight > maxHeightPx) {
    layout = layoutWithFonts(name, dims, maxWidthPx, true);
  }
  if (!layout.lines.length) {
    layout = layoutWithFonts("Room", "", maxWidthPx, true);
  }
  return layout;
}

export function measureRoomLabelLines(text, font, maxWidthPx) {
  const prepared = prepareWithSegments(String(text || ""), font);
  return measureLineStats(prepared, maxWidthPx);
}
