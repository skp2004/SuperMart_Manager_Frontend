import {
  Component,
  OnInit,
  ElementRef,
  AfterViewInit,
  ViewChild,
} from '@angular/core';
import { Bill } from '../../models/bill.model';
import { BillService } from '../../services/bill.service';
import { FormsModule, NgForm } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CommonModule } from '@angular/common';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { InputMask } from 'primeng/inputmask';
interface PaymentMethod {
  label: string;
  value: string;
  icon: string;
}

@Component({
  selector: 'app-bill',
  standalone: true,
  imports: [
    InputMask,
    FormsModule,
    InputTextModule,
    ButtonModule,
    CommonModule,
    CheckboxModule,
    ToastModule,
    SelectModule,
    DialogModule,
  ],
  templateUrl: './bill.component.html',
  styleUrl: './bill.component.css',
  providers: [MessageService],
})
export class BillComponent implements OnInit {
  bill: Bill[] = [];
  isCreatingBill: boolean = false;
  isAddingProduct: boolean = false;
  isProcessingPayment: boolean = false;
  isApplyingDiscount: boolean = false;
  isCreatingInvoice: boolean = false;
  isRemovingItem: boolean = false;
  customerPhone: string = '';
  customerEmail: string = '';
  submittedBill: Bill | null = null;
  barcode: string = '';
  quantity: number = 1;
  paymentMethods: PaymentMethod[] = [
    { label: 'Cash', value: 'CASH', icon: 'pi pi-money-bill' },
    { label: 'UPI', value: 'UPI', icon: 'pi pi-mobile' },
  ];
  currentYear: number = new Date().getFullYear();
  selectedPaymentMethod: PaymentMethod | null = this.paymentMethods[0];
  invoiceDialogVisible: boolean = false;

  @ViewChild('itemInput') itemInput!: ElementRef;
  @ViewChild('phoneInput') phoneInput!: ElementRef;

  constructor(
    private billService: BillService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {}

  ngAfterViewInit() {
    setTimeout(() => {
      this.phoneInput.nativeElement.focus();
    });
  }

  createBill(): void {
    if (!this.customerPhone && !this.customerEmail) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Enter either phone or email',
      });
      return;
    }
    this.isCreatingBill = true;
    this.billService
      .createBill({ phone: this.customerPhone, email: this.customerEmail })
      .subscribe({
        next: (response: any) => {
          if (response.success) {
            this.bill.push(response.data);
            this.submittedBill = response.data;
            setTimeout(() => {
              this.itemInput.nativeElement.focus();
            });
          } else {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Bill creation failed',
            });
          }
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to create bill',
          });
        },
        complete: () => {
          this.isCreatingBill = false;
        },
      });
  }

  addProductToBill(): void {
    const barcodeInput = document.getElementById('barcode') as HTMLInputElement;
    const qtyInput = document.getElementById('quantity') as HTMLInputElement;

    const barcode = barcodeInput.value.trim();
    const qty = Number(qtyInput.value) || 1;

    if (!this.submittedBill) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Please create a bill first',
      });
      return;
    }

    if (!barcode) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Please enter a valid barcode',
      });
      return;
    }

    if (isNaN(qty) || qty <= 0) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Quantity must be a positive number',
      });
      return;
    }

    const productData = {
      billId: this.submittedBill._id,
      barcode,
      qty,
    };
    this.isAddingProduct = true;
    this.billService.addProductToBill(productData).subscribe({
      next: (response: any) => {
        if (response.success && this.submittedBill) {
          this.submittedBill = {
            ...this.submittedBill,
            items: response.data.items,
            totalAmount: response.data.totalAmount,
            subtotal: response.data.subtotal,
          };

          barcodeInput.value = '';
          qtyInput.value = '1';

          requestAnimationFrame(() => {
            this.itemInput.nativeElement.focus();
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to add product',
          });
        }
      },
      error: (error) => {
        const errorMessage =
          error.error?.message || 'An error occurred while adding the product';
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: errorMessage,
        });
      },
      complete: () => {
        this.isAddingProduct = false;
      },
    });
  }

  processPayment(): void {
    if (!this.submittedBill) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Create a bill first',
      });
      return;
    }

    if (!this.selectedPaymentMethod) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Select Payment Method',
      });
      return;
    }

    const paymentDetails = {
      method: this.selectedPaymentMethod.value,
    };
    this.isProcessingPayment = true;
    this.billService
      .addPaymentToBill({ billId: this.submittedBill._id, paymentDetails })
      .subscribe({
        next: (response: any) => {
          if (response && response.success) {
            if (
              this.selectedPaymentMethod &&
              this.selectedPaymentMethod.value === 'CASH'
            ) {
              this.messageService.add({
                severity: 'success',
                summary: 'Payment Successful',
                detail: 'Payment received in Cash',
              });
              this.resetBillData();
              return;
            } else {
              this.openRazorpayPayment(response.data);
            }
          } else {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Payment failed:',
            });
          }
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Payment failed:' + error.message,
          });
        },
        complete: () => {
          this.isProcessingPayment = false;
        },
      });
  }

  openRazorpayPayment(paymentData: any) {
    const options: any = {
      key: paymentData.key,
      amount: paymentData.amount,
      currency: paymentData.currency,
      name: 'Supermarket Manager',
      description: 'Test Transaction',
      order_id: paymentData.orderId,
      prefill: {
        email: this.customerEmail,
        contact: this.customerPhone,
      },
      // handler: (response: any) => {
      //     this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Payment Success:' });
      //     this.resetBillData();
      // },
      handler: (response: any) => {
        // Send payment confirmation to the backend
        console.log(response, " sdrfgergtsergte");
        if (!this.submittedBill) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Bill data is missing',
          });
          return;
        }
        const paymentSuccessData = {
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
          billId: this.submittedBill._id,
        };
        console.log(paymentSuccessData);
        this.billService.verifyPayment(paymentSuccessData).subscribe({
          next: (res: any) => {
            if (res.success) {
              this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Payment recorded successfully',
              });
              this.resetBillData();
            } else {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Payment verification failed',
              });
            }
            console.log(res);
          },
          error: (err) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to save payment: ' + err.message,
            });
          },
        });
      },
      modal: {
        ondismiss: () => {
          console.log('Payment popup closed');
        },
      },
    };

    const razorpay = new (window as any).Razorpay(options);
    razorpay.open();
  }

  applyDiscount(): void {
    if (this.submittedBill) {
      const discount = parseFloat(
        (document.getElementById('totalDiscount') as HTMLInputElement).value
      );
      if (!discount) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Enter a valid discount',
        });
        return;
      }
      console.log(discount);
      this.billService
        .addDiscountToBill({
          discount: discount,
          billId: this.submittedBill?._id,
        })
        .subscribe({
          next: (response: any) => {
            if (response.success) {
              if (this.submittedBill) {
                this.submittedBill = {
                  ...this.submittedBill,
                  totalDiscount: response.data.totalDiscount,
                  totalAmount: response.data.totalAmount,
                  subtotal: response.data.subtotal,
                };
              }
              this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Discount applied successfully',
              });
              (
                document.getElementById('totalDiscount') as HTMLInputElement
              ).value = discount.toString();
            } else {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to apply discount',
              });
            }
          },
          error: (error) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to apply discount',
            });
          },
        });
    }
  }
  resetBillData(): void {
    this.customerPhone = '';
    this.customerEmail = '';
    this.barcode = '';
    this.quantity = 1;
    this.selectedPaymentMethod = this.paymentMethods[0];
    this.submittedBill = null;
  }

  showInvoiceDialog(): void {
    console.log(this.submittedBill);
    this.invoiceDialogVisible = true;
  }

  printInvoice(): void {
    const invoiceElement = document.getElementById('invoice-content');

    if (invoiceElement) {
      const printWindow = window.open('', '', 'width=800,height=600');
      if (printWindow) {
        printWindow.document.write(invoiceElement.innerHTML);
        printWindow.document.close();
        printWindow.print();
        printWindow.onafterprint = () => {
          printWindow.close();
        };
      } else {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to open print window.',
        });
      }
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Could not find invoice content.',
      });
    }
  }

  onRemoveItem(billId: string, productId: string) {
    this.billService.removeItemFromBill({ billId, productId }).subscribe({
      next: (response: any) => {
        if (response.success) {
          // Update the submittedBill with the refreshed items and other relevant fields
          if (this.submittedBill) {
            this.submittedBill = {
              ...this.submittedBill,
              items: response.data.items, // Update only the items
              subtotal: response.data.subtotal, // Update subtotal if returned
              totalAmount: response.data.totalAmount, // Update total amount if returned
              totalDiscount: response.data.totalDiscount, // Update discount if returned
            };
          }
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Item removed successfully',
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to remove item',
          });
        }
      },
      error: (err) => {
        console.error('Error removing item from bill', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error removing item: ' + err.message,
        });
      },
    });
  }
}
