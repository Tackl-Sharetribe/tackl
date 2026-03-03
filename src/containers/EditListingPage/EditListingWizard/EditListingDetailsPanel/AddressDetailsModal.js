import React from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { FormattedMessage } from '../../../../util/reactIntl';

import { H3, Modal } from '../../../../components';

import AddressForm from '../../../AddressPage/AddressForm/AddressForm';
import { updateProfile } from '../../../ProfileSettingsPage/ProfileSettingsPage.duck';

/**
 * A modal that prompts the user to save their address before continuing.
 * Handles the updateProfile dispatch internally.
 *
 * @component
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Called when the modal is closed
 * @param {Function} props.onManageDisableScrolling - Required by Modal
 * @param {Function} props.onAddressSaved - Called after the address is successfully saved
 */
const AddressDetailsModal = props => {
  const { isOpen, onClose, onManageDisableScrolling, onAddressSaved, displayName } = props;
  const dispatch = useDispatch();
  const { updateInProgress } = useSelector(state => state.ProfileSettingsPage);

  const initialValues = {
    recipientName: displayName,
    recipientCountry: 'GB',
  };

  const handleAddressSubmit = values => {
    const {
      recipientName,
      recipientPhoneNumber,
      recipientAddressLine1,
      recipientAddressLine2,
      recipientPostal,
      recipientCity,
      recipientState,
      recipientCountry,
    } = values;

    const profile = {
      protectedData: {
        address: {
          recipientName,
          recipientPhoneNumber: recipientPhoneNumber || null,
          recipientAddressLine1,
          recipientAddressLine2: recipientAddressLine2 || null,
          recipientPostal,
          recipientCity,
          recipientState: recipientState || null,
          recipientCountry,
        },
      },
    };

    return dispatch(updateProfile(profile)).then(() => {
      onClose();
      if (onAddressSaved) {
        onAddressSaved();
      }
    });
  };

  return (
    <Modal
      id="EditListingDetailsPanel.addressModal"
      isOpen={isOpen}
      onClose={onClose}
      onManageDisableScrolling={onManageDisableScrolling}
      usePortal
    >
      <H3 as="h2">
        <FormattedMessage id="EditListingDetailsPanel.addressModalTitle" />
      </H3>
      <AddressForm
        onSubmit={handleAddressSubmit}
        inProgress={updateInProgress}
        initialValues={initialValues}
      />
    </Modal>
  );
};

export default AddressDetailsModal;
