import { isPromise } from "../../jsutils/isPromise.mjs";
export class Computation {
    constructor(fn, onAbort) {
        this._fn = fn;
        this._onAbort = onAbort;
    }
    prime() {
        if (this._maybePromise) {
            return this._maybePromise;
        }
        try {
            const result = this._fn();
            if (isPromise(result)) {
                this._maybePromise = { status: 'pending', promise: result };
                result.then((value) => {
                    this._maybePromise = { status: 'fulfilled', value };
                }, (reason) => {
                    this._maybePromise = { status: 'rejected', reason };
                });
            }
            else {
                this._maybePromise = { status: 'fulfilled', value: result };
            }
        }
        catch (reason) {
            this._maybePromise = { status: 'rejected', reason };
        }
        return this._maybePromise;
    }
    result() {
        const maybePromise = this.prime();
        switch (maybePromise.status) {
            case 'fulfilled':
                return maybePromise.value;
            case 'rejected':
                throw maybePromise.reason;
            case 'pending': {
                return maybePromise.promise;
            }
        }
    }
    abort(reason) {
        const maybePromise = this._maybePromise;
        if (!maybePromise) {
            this._maybePromise = {
                status: 'rejected',
                reason,
            };
            return;
        }
        const status = maybePromise.status;
        if (status === 'pending') {
            this._maybePromise = {
                status: 'rejected',
                reason,
            };
            if (this._onAbort) {
                return this._onAbort(reason);
            }
        }
    }
}
//# sourceMappingURL=Computation.mjs.map