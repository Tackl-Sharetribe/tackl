import { useState } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';

import { useConfiguration } from '../../context/configurationContext';

import { ensureCurrentUser } from '../../util/data';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { showCreateListingLinkForUser, showPaymentDetailsForUser } from '../../util/userHelpers';

import { isScrollingDisabled } from '../../ducks/ui.duck';

import { H3, LayoutSideNavigation, Page, UserNav } from '../../components';

import FooterContainer from '../FooterContainer/FooterContainer';
import TopbarContainer from '../TopbarContainer/TopbarContainer';

import { updateProfile } from '../ProfileSettingsPage/ProfileSettingsPage.duck';
import AddressForm from './AddressForm/AddressForm';

import css from './AddressPage.module.css';

/**
 * AddressPage allows users to manage their address details.
 * Reuses the ShippingDetails component from the checkout flow.
 *
 * @param {Object} props
 * @param {boolean} props.scrollingDisabled - Whether scrolling is disabled
 * @param {Object} props.currentUser - The current user
 * @param {Function} props.onSubmit - The submit handler
 * @param {boolean} [props.updateInProgress] - Whether profile update is in progress
 * @param {Object} [props.updateProfileError] - Profile update error
 * @returns {JSX.Element}
 */
function AddressPageComponent(props) {
  const { scrollingDisabled, currentUser, onSubmit, updateInProgress = false } = props;
  const config = useConfiguration();
  const intl = useIntl();
  const [addressSaved, setAddressSaved] = useState(false);

  const user = ensureCurrentUser(currentUser);
  const { displayName, protectedData } = user.attributes.profile || {};
  const {
    recipientName,
    recipientPhoneNumber,
    recipientAddressLine1,
    recipientAddressLine2,
    recipientPostal,
    recipientCity,
    recipientState,
    recipientCountry,
  } = protectedData?.address || {};

  const initialValues = {
    recipientName: recipientName || displayName,
    recipientPhoneNumber: recipientPhoneNumber || '',
    recipientAddressLine1: recipientAddressLine1 || '',
    recipientAddressLine2: recipientAddressLine2 || '',
    recipientPostal: recipientPostal || '',
    recipientCity: recipientCity || '',
    recipientState: recipientState || '',
    recipientCountry: recipientCountry || 'GB',
  };

  const handleSubmit = values => {
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

    return onSubmit(profile).then(() => {
      setAddressSaved(true);
    });
  };

  const title = intl.formatMessage({ id: 'AddressPage.title' });
  const showManageListingsLink = showCreateListingLinkForUser(config, currentUser);
  const { showPayoutDetails, showPaymentMethods } = showPaymentDetailsForUser(config, currentUser);
  const accountSettingsNavProps = {
    currentPage: 'AddressPage',
    showPaymentMethods,
    showPayoutDetails,
  };

  const addressForm = user.id ? (
    <AddressForm
      className={css.form}
      initialValues={initialValues}
      onSubmit={handleSubmit}
      inProgress={updateInProgress}
      ready={addressSaved}
    />
  ) : null;

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSideNavigation
        topbar={
          <>
            <TopbarContainer
              desktopClassName={css.desktopTopbar}
              mobileClassName={css.mobileTopbar}
            />
            <UserNav currentPage="AddressPage" showManageListingsLink={showManageListingsLink} />
          </>
        }
        sideNav={null}
        useAccountSettingsNav
        accountSettingsNavProps={accountSettingsNavProps}
        footer={<FooterContainer />}
        intl={intl}
      >
        <div className={css.content}>
          <H3 as="h1">
            <FormattedMessage id="AddressPage.heading" />
          </H3>
          {addressForm}
        </div>
      </LayoutSideNavigation>
    </Page>
  );
}

const mapStateToProps = state => {
  const { currentUser } = state.user;
  const { updateInProgress, updateProfileError } = state.ProfileSettingsPage;

  return {
    currentUser,
    updateInProgress,
    updateProfileError,
    scrollingDisabled: isScrollingDisabled(state),
  };
};

const mapDispatchToProps = dispatch => ({
  onSubmit: params => dispatch(updateProfile(params)),
});

const AddressPage = compose(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )
)(AddressPageComponent);

export default AddressPage;
