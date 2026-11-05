import { prepareReceiptImage } from './receipt-image';

const mockDecode = jest.fn();
const context = {
  fillStyle: '',
  fillRect: jest.fn(),
  translate: jest.fn(),
  rotate: jest.fn(),
  drawImage: jest.fn(),
};
const bitmap = { width: 2048, height: 1542, close: jest.fn() };
const file = new File(['original camera bytes'], 'receipt.jpg', { type: 'image/jpeg' });
const originalDecoder = globalThis.createImageBitmap;

beforeEach(() => {
  jest.clearAllMocks();
  globalThis.createImageBitmap = mockDecode;
  mockDecode.mockResolvedValue(bitmap);
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(context as unknown as CanvasRenderingContext2D);
  jest.spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation((callback) => callback(new Blob(['prepared JPEG bytes'], { type: 'image/jpeg' })));
});

afterEach(() => {
  jest.restoreAllMocks();
  globalThis.createImageBitmap = originalDecoder;
});

test.each([
  [0, 2048, 1542, 0],
  [1, 1542, 2048, Math.PI / 2],
  [2, 2048, 1542, Math.PI],
  [3, 1542, 2048, 3 * Math.PI / 2],
] as const)('EXIF is applied before %i quarter turns are baked into encoded pixels', async (turns, width, height, radians) => {
  const image = await prepareReceiptImage(file, turns);
  expect(mockDecode).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' });
  expect(context.translate).toHaveBeenCalledWith(width / 2, height / 2);
  expect(context.rotate).toHaveBeenCalledWith(radians);
  expect(context.drawImage).toHaveBeenCalledWith(bitmap, -1024, -771, 2048, 1542);
  expect(image).toEqual({
    data: btoa('prepared JPEG bytes'),
    mimeType: 'image/jpeg',
    width,
    height,
  });
  expect(bitmap.close).toHaveBeenCalled();
});

test('rejects unsupported and oversized source files before decoding', async () => {
  await expect(prepareReceiptImage(new File(['pdf'], 'receipt.pdf', { type: 'application/pdf' })))
    .rejects.toThrow('JPEG');
  const oversized = new File(['photo'], 'large.jpg', { type: 'image/jpeg' });
  Object.defineProperty(oversized, 'size', { value: 10 * 1024 * 1024 + 1 });
  await expect(prepareReceiptImage(oversized)).rejects.toThrow('10 MB');
  expect(mockDecode).not.toHaveBeenCalled();
});

test('reports undecodable images and failed encoding while releasing the bitmap', async () => {
  mockDecode.mockRejectedValueOnce(new Error('Bad image'));
  await expect(prepareReceiptImage(file)).rejects.toThrow('could not be opened');
  jest.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => callback(null));
  await expect(prepareReceiptImage(file)).rejects.toThrow('could not compress');
  expect(bitmap.close).toHaveBeenCalled();
});

test('shrinks oversized dimensions without changing aspect ratio', async () => {
  mockDecode.mockResolvedValueOnce({ ...bitmap, width: 4000, height: 3000 });
  const image = await prepareReceiptImage(file, 1);
  expect(image).toMatchObject({ width: 1800, height: 2400 });
  expect(context.drawImage).toHaveBeenCalledWith(
    expect.objectContaining({ width: 4000, height: 3000 }), -1200, -900, 2400, 1800,
  );
});
