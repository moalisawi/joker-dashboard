'use client'

import type { Subscriber } from '@/types'
import SubscriberModal from './SubscriberModal'
import WithdrawModal from './WithdrawModal'
import PaymentModal from './PaymentModal'
import ProfileModal from './ProfileModal'
import RenewalModal from './RenewalModal'
import PauseModal from './PauseModal'
import FreezeModal from './FreezeModal'
import ResumeModal from './ResumeModal'
import ExchangeRatesModal from '@/components/stats/ExchangeRatesModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { ExchangeRates } from '@/types'

export type ModalState =
  | { type: 'none' }
  | { type: 'add' }
  | { type: 'profile'; subscriber: Subscriber }
  | { type: 'edit'; subscriber: Subscriber }
  | { type: 'withdraw'; subscriber: Subscriber }
  | { type: 'payment'; subscriber: Subscriber }
  | { type: 'renew'; subscriber: Subscriber }
  | { type: 'pause'; subscriber: Subscriber }
  | { type: 'freeze'; subscriber: Subscriber }
  | { type: 'resume'; subscriber: Subscriber }
  | { type: 'rates' }
  | { type: 'confirmDelete'; subscriberId: string; subscriberName: string }

interface SubscriberModalsManagerProps {
  modal: ModalState
  exchangeRates: ExchangeRates
  deleteLoading?: boolean
  onClose: () => void
  onSaved?: () => void
  onConfirmDelete?: () => void
}

export default function SubscriberModalsManager({
  modal,
  exchangeRates,
  deleteLoading = false,
  onClose,
  onSaved = () => {},
  onConfirmDelete = () => {},
}: SubscriberModalsManagerProps) {
  return (
    <>
      {modal.type === 'profile' && (
        <ProfileModal
          subscriber={modal.subscriber}
          onClose={onClose}
          onEdit={() => {}}
          onRenew={() => {}}
          onAddPayment={() => {}}
        />
      )}
      {modal.type === 'add' && (
        <SubscriberModal
          mode="add"
          exchangeRates={exchangeRates}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
      {modal.type === 'edit' && (
        <SubscriberModal
          mode="edit"
          subscriber={modal.subscriber}
          exchangeRates={exchangeRates}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
      {modal.type === 'withdraw' && (
        <WithdrawModal
          subscriber={modal.subscriber}
          exchangeRates={exchangeRates}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
      {modal.type === 'payment' && (
        <PaymentModal
          subscriber={modal.subscriber}
          exchangeRates={exchangeRates}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
      {modal.type === 'renew' && (
        <RenewalModal
          subscriber={modal.subscriber}
          exchangeRates={exchangeRates}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
      {modal.type === 'pause' && (
        <PauseModal
          subscriber={modal.subscriber}
          onClose={onClose}
          onSaved={() => {
            onClose()
            onSaved?.()
          }}
        />
      )}
      {modal.type === 'freeze' && (
        <FreezeModal
          subscriber={modal.subscriber}
          isOpen={true}
          onClose={onClose}
          onFrozen={() => {
            onClose()
            onSaved?.()
          }}
          currentUser={{ uid: '', displayName: '' }}
        />
      )}
      {modal.type === 'resume' && (
        <ResumeModal
          subscriber={modal.subscriber}
          isOpen={true}
          onClose={onClose}
          onResumed={() => {
            onClose()
            onSaved?.()
          }}
          currentUser={{ uid: '', displayName: '' }}
        />
      )}
      {modal.type === 'rates' && <ExchangeRatesModal onClose={onClose} />}
      <ConfirmDialog
        open={modal.type === 'confirmDelete'}
        onClose={onClose}
        onConfirm={onConfirmDelete}
        loading={deleteLoading}
        destructive
        title="حذف المشترك"
        description={
          modal.type === 'confirmDelete'
            ? `هل أنت متأكد من حذف "${modal.subscriberName}"؟ هذا الإجراء لا يمكن التراجع عنه.`
            : undefined
        }
        confirmLabel="حذف نهائياً"
      />
    </>
  )
}
