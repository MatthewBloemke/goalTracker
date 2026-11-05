import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReceiptImagePreview } from './ReceiptImagePreview';
import { prepareReceiptImage } from '../_lib/receipt-image';

jest.mock('../_lib/receipt-image', () => ({ prepareReceiptImage: jest.fn() }));
const file = new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' });
const image = { data: 'b3JpZ2luYWw=', mimeType: 'image/jpeg' as const, width: 2048, height: 1542 };

test('analysis uses the exact rotated JPEG shown in the preview', async () => {
  const rotated = { ...image, data: 'cm90YXRlZA==', width: 1542, height: 2048 };
  jest.mocked(prepareReceiptImage).mockResolvedValueOnce(image).mockResolvedValueOnce(rotated);
  const analyze = jest.fn();
  render(<ReceiptImagePreview file={file} onAnalyze={analyze} onCancel={jest.fn()} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Analyze photo' })).toBeEnabled());
  expect(analyze).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Rotate receipt right' }));
  expect(screen.getByRole('button', { name: 'Analyze photo' })).toBeDisabled();
  await waitFor(() => expect(screen.getByAltText('Receipt photo to be analyzed'))
    .toHaveAttribute('src', 'data:image/jpeg;base64,cm90YXRlZA=='));
  expect(prepareReceiptImage).toHaveBeenLastCalledWith(file, 1);
  fireEvent.click(screen.getByRole('button', { name: 'Analyze photo' }));
  expect(analyze).toHaveBeenCalledWith(rotated);
});

test('invalid photos remain local and can be cancelled', async () => {
  jest.mocked(prepareReceiptImage).mockRejectedValueOnce(new Error('Choose a JPEG, PNG, or WebP image.'));
  const analyze = jest.fn();
  const cancel = jest.fn();
  render(<ReceiptImagePreview file={file} onAnalyze={analyze} onCancel={cancel} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose a JPEG');
  expect(screen.getByRole('button', { name: 'Analyze photo' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel photo' }));
  expect(cancel).toHaveBeenCalled();
  expect(analyze).not.toHaveBeenCalled();
});
