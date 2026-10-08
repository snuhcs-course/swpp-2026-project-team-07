import React, { forwardRef, useImperativeHandle } from 'react';

// Only the native renderer boundary is simulated. Tests explicitly deliver its
// page/load callbacks; requesting a page never pretends it is already visible.
export const pageRequests = [];
export default forwardRef(function Pdf(props, ref) {
  useImperativeHandle(ref, () => ({ setPage(page) { pageRequests.push(page); } }), []);
  return React.createElement('pdf', props);
});
