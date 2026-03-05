import React, { useRef, useState } from 'react';
import classNames from 'classnames';
import { Form as FinalForm } from 'react-final-form';

import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import { required } from '../../../util/validators';
import { generatePresignedUrl } from '../../../util/api';

import { FieldTextInput, Form, Modal, PrimaryButton } from '../../../components';

import css from './OwnShippingModal.module.css';

const ACCEPT_IMAGES = 'image/*';

/**
 * Upload a single file via presigned URL.
 *
 * @param {File} file
 * @param {string} storagePath
 * @returns {Promise<{ url: string }>}
 */
const uploadFile = async (file, storagePath) => {
  const resp = await generatePresignedUrl({
    storagePath,
    files: [{ name: file.name, type: file.type }],
  });

  if (!resp?.data?.[0]) {
    throw new Error('Failed to generate presigned URL');
  }

  const { presignedUrl, publicUrl } = resp.data[0];

  await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  return { url: publicUrl };
};

/**
 * Image upload field managed outside Final Form (files cannot be serialized).
 * Exposes uploaded URLs via onChange callback.
 */
const ImageUploadField = ({ txId, images, onChange, disabled }) => {
  const intl = useIntl();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const handleFileChange = async e => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    setUploadError(null);

    try {
      const storagePath = `shipment-proofs/${txId}`;
      const results = await Promise.all(files.map(file => uploadFile(file, storagePath)));
      const newImages = [
        ...images,
        ...results.map((r, i) => ({
          url: r.url,
          preview: URL.createObjectURL(files[i]),
        })),
      ];
      onChange(newImages);
    } catch (_e) {
      setUploadError(intl.formatMessage({ id: 'OwnShippingModal.uploadFailed' }));
    } finally {
      setUploading(false);
      // Reset so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = index => {
    const updated = images.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className={css.uploadSection}>
      <label className={css.uploadLabel}>
        <FormattedMessage id="OwnShippingModal.shipmentProofLabel" />
      </label>

      <button
        type="button"
        className={classNames(css.uploadButton, {
          [css.uploadButtonDisabled]: uploading || disabled,
        })}
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || disabled}
      >
        <FormattedMessage id="OwnShippingModal.uploadButtonText" />
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_IMAGES}
        multiple
        className={css.hiddenInput}
        onChange={handleFileChange}
        disabled={uploading || disabled}
      />

      {images.length > 0 && (
        <div className={css.previewContainer}>
          {images.map((img, i) => (
            <div key={i} className={css.previewItem}>
              <img src={img.preview || img.url} alt="" className={css.previewImage} />
              {!uploading && !disabled && (
                <button type="button" className={css.removeButton} onClick={() => handleRemove(i)}>
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {uploading && (
        <div className={css.previewItem} style={{ marginTop: 12 }}>
          <div className={css.uploadingOverlay}>
            <div className={css.spinner} />
          </div>
        </div>
      )}

      {uploadError && <p className={css.uploadError}>{uploadError}</p>}
    </div>
  );
};

/**
 * The form rendered inside the modal.
 */
const OwnShippingForm = props => {
  const [images, setImages] = useState([]);

  return (
    <FinalForm
      {...props}
      render={fieldRenderProps => {
        const {
          handleSubmit,
          invalid,
          disabled,
          intl,
          submitInProgress,
          submitReady,
          txId,
        } = fieldRenderProps;

        const imagesValid = images.length > 0;
        const submitDisabled = invalid || disabled || submitInProgress || !imagesValid;

        const handleFormSubmit = e => {
          e.preventDefault();
          const formValues = fieldRenderProps.values;
          props.onSubmit({ ...formValues, shipmentProofImages: images.map(i => i.url) });
        };

        return (
          <Form className={css.formRoot} onSubmit={handleFormSubmit}>
            <FieldTextInput
              className={css.fieldGroup}
              type="text"
              id="ownShipping.carrierName"
              name="carrierName"
              label={intl.formatMessage({ id: 'OwnShippingModal.carrierNameLabel' })}
              placeholder={intl.formatMessage({ id: 'OwnShippingModal.carrierNamePlaceholder' })}
              validate={required(
                intl.formatMessage({ id: 'OwnShippingModal.carrierNameRequired' })
              )}
            />

            <FieldTextInput
              className={css.fieldGroup}
              type="text"
              id="ownShipping.trackingNumber"
              name="trackingNumber"
              label={intl.formatMessage({ id: 'OwnShippingModal.trackingNumberLabel' })}
              placeholder={intl.formatMessage({
                id: 'OwnShippingModal.trackingNumberPlaceholder',
              })}
              validate={required(
                intl.formatMessage({ id: 'OwnShippingModal.trackingNumberRequired' })
              )}
            />

            <ImageUploadField
              txId={txId}
              images={images}
              onChange={setImages}
              disabled={submitInProgress}
            />

            {!imagesValid && images.length === 0 ? null : !imagesValid ? (
              <p className={css.fieldError}>
                <FormattedMessage id="OwnShippingModal.shipmentProofRequired" />
              </p>
            ) : null}

            <PrimaryButton
              className={css.submitButton}
              type="submit"
              inProgress={submitInProgress}
              disabled={submitDisabled}
              ready={submitReady}
            >
              <FormattedMessage id="OwnShippingModal.submitButton" />
            </PrimaryButton>
          </Form>
        );
      }}
    />
  );
};

/**
 * Modal for providers who manage their own shipping.
 * Collects carrier name, tracking number, and shipment proof images.
 *
 * @component
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Function} props.onManageDisableScrolling
 * @param {Function} props.onSubmit - Called with { carrierName, trackingNumber, shipmentProofImages }
 * @param {boolean} [props.submitInProgress]
 * @param {boolean} [props.submitReady]
 * @param {Object} props.txId - Transaction UUID
 */
const OwnShippingModal = props => {
  const intl = useIntl();
  const {
    isOpen,
    onClose,
    onManageDisableScrolling,
    onSubmit,
    submitInProgress = false,
    submitReady = false,
    txId,
  } = props;

  return (
    <Modal
      id="ActionButtons.ownShippingModal"
      //   containerClassName={css.root}
      contentClassName={css.modalContent}
      isOpen={isOpen}
      onClose={onClose}
      onManageDisableScrolling={onManageDisableScrolling}
      usePortal
      closeButtonMessage={intl.formatMessage({ id: 'OwnShippingModal.close' })}
    >
      <p className={css.modalTitle}>
        <FormattedMessage id="OwnShippingModal.title" />
      </p>
      <p className={css.modalMessage}>
        <FormattedMessage id="OwnShippingModal.description" />
      </p>
      <OwnShippingForm
        onSubmit={onSubmit}
        intl={intl}
        submitInProgress={submitInProgress}
        submitReady={submitReady}
        txId={txId}
      />
    </Modal>
  );
};

export default OwnShippingModal;
