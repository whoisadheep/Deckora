import PptxGenJS from 'pptxgenjs';

async function run() {
  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();
  
  // Test triangle
  slide.addShape(pptx.ShapeType.triangle, { x: 1, y: 1, w: 2, h: 2, fill: { color: 'C05A35' } });
  
  // Test overlapping triangle
  slide.addShape(pptx.ShapeType.triangle, { x: 1, y: 2, w: 2, h: 2, fill: { color: '5C4A3A' } });

  // Test rectangle
  slide.addShape(pptx.ShapeType.rect, { x: 4, y: 1, w: 2, h: 2, fill: { color: 'EDE5DC' } });

  await pptx.writeFile({ fileName: 'shape-test.pptx' });
  console.log('Success');
}

run();
