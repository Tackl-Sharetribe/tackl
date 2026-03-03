import React from 'react';
import { Form as FinalForm } from 'react-final-form';

import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import { useConfiguration } from '../../../context/configurationContext';

import { Form, PrimaryButton } from '../../../components';

import ShippingDetails from '../../CheckoutPage/ShippingDetails/ShippingDetails';

import css from './AddressForm.module.css';

const FORM_ID = 'AddressForm';

/**
 * A form component for collecting user address details.
 * Reuses the ShippingDetails component from the checkout flow.
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className] - The class name
 * @param {Object} [props.initialValues] - The initial form values
 * @param {boolean} [props.inProgress] - Whether submission is in progress
 * @param {boolean} [props.ready] - Whether the form has been successfully submitted
 * @param {Function} props.onSubmit - The submit handler
 * @returns {JSX.Element}
 */
const AddressForm = props => {
  const { className, initialValues, inProgress = false, ready = false, onSubmit } = props;
  const intl = useIntl();
  const config = useConfiguration();
  const locale = config.localization.locale;

  return (
    <FinalForm
      initialValues={initialValues}
      onSubmit={onSubmit}
      render={fieldRenderProps => {
        const { handleSubmit, form, pristine, submitting, values, ...rest } = fieldRenderProps;

        const submitDisabled = pristine || inProgress || submitting;
        const submitReady = ready;
        const submitInProgress = inProgress;

        return (
          <Form className={className} onSubmit={handleSubmit}>
            <ShippingDetails
              intl={intl}
              formApi={form}
              locale={locale}
              fieldId={FORM_ID}
              hideHeading
            />

            <PrimaryButton
              className={css.submitButton}
              type="submit"
              inProgress={submitInProgress}
              disabled={submitDisabled}
              ready={submitReady}
            >
              <FormattedMessage id="AddressForm.saveChanges" />
            </PrimaryButton>
          </Form>
        );
      }}
    />
  );
};

export default AddressForm;
