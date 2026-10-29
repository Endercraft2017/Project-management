import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OperatorMfaForm } from './OperatorMfaForm';
import ConsoleLogin from '@/pages/ConsoleLogin';
import { accessApi, AccessError, navigateTo } from '@/lib/access-api';

vi.mock('@/lib/access-api',async()=>{
  const actual=await vi.importActual<typeof import('@/lib/access-api')>('@/lib/access-api');
  return {...actual,navigateTo:vi.fn(),accessApi:{operatorMfa:vi.fn(),beginOperatorMfa:vi.fn(),enableOperatorMfa:vi.fn(),disableOperatorMfa:vi.fn(),operatorLogin:vi.fn(),verifyOperatorMfa:vi.fn()}};
});
const signIn=vi.fn();
beforeEach(()=>{
  vi.resetAllMocks();
  vi.mocked(accessApi.operatorMfa).mockResolvedValue({configured:true,enabled:false});
});
const enter=(name:string,value:string)=>fireEvent.change(screen.getByLabelText(name),{target:{value}});
it('keeps a password-verified operator at the challenge until second-factor verification succeeds',async()=>{
  vi.mocked(accessApi.operatorLogin).mockResolvedValue({mfaRequired:true});
  vi.mocked(accessApi.verifyOperatorMfa).mockResolvedValue({user:{id:'op',name:'Operator',email:'operator@example.test'}});
  render(<ConsoleLogin/>);
  enter('Operator email','operator@example.test');enter('Password','Example-test-password');
  fireEvent.click(screen.getByRole('button',{name:'Log in to console'}));
  await screen.findByLabelText('Authenticator or recovery code');expect(navigateTo).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  enter('Authenticator or recovery code','123456');fireEvent.click(screen.getByRole('button',{name:'Verify code'}));
  await waitFor(()=>expect(accessApi.verifyOperatorMfa).toHaveBeenCalledWith('123456'));
  await waitFor(()=>expect(navigateTo).toHaveBeenCalledWith('/console/tenants'));
});
it('enrolls only after current-password proof and clears the setup secret after confirmation',async()=>{
  vi.mocked(accessApi.beginOperatorMfa).mockResolvedValue({secret:'TEST-SETUP-KEY',uri:'otpauth://fixture',expiresInSeconds:600});
  vi.mocked(accessApi.enableOperatorMfa).mockResolvedValue({recoveryCodes:['fixture-one','fixture-two'],signInRequired:false});
  render(<OperatorMfaForm disabled={false} onSignInRequired={signIn}/>);
  await screen.findByText('Set up an authenticator');
  enter('Current password for authenticator changes','Example-password');fireEvent.click(screen.getByRole('button',{name:'Create setup key',hidden:true}));
  await screen.findByLabelText('Authenticator setup key');expect(accessApi.beginOperatorMfa).toHaveBeenCalledWith('Example-password');
  enter('Six-digit authenticator code','123456');fireEvent.click(screen.getByRole('button',{name:'Confirm and enable MFA',hidden:true}));
  await screen.findByLabelText('One-use recovery codes');expect(screen.queryByLabelText('Authenticator setup key')).not.toBeInTheDocument();
  expect(screen.getByLabelText('One-use recovery codes')).toHaveValue('fixture-one\nfixture-two');
  fireEvent.click(screen.getByRole('button',{name:'I saved my recovery codes'}));
  expect(screen.queryByLabelText('One-use recovery codes')).not.toBeInTheDocument();expect(signIn).not.toHaveBeenCalled();
});
it('retains one-time recovery codes until acknowledged when the current session could not renew',async()=>{
  vi.mocked(accessApi.beginOperatorMfa).mockResolvedValue({secret:'TEST-SETUP-KEY',uri:'otpauth://fixture',expiresInSeconds:600});
  vi.mocked(accessApi.enableOperatorMfa).mockResolvedValue({recoveryCodes:['fixture-recovery'],signInRequired:true});
  render(<OperatorMfaForm disabled={false} onSignInRequired={signIn}/>);await screen.findByText('Set up an authenticator');
  enter('Current password for authenticator changes','Example-password');fireEvent.click(screen.getByRole('button',{name:'Create setup key',hidden:true}));
  await screen.findByLabelText('Authenticator setup key');enter('Six-digit authenticator code','123456');fireEvent.click(screen.getByRole('button',{name:'Confirm and enable MFA',hidden:true}));
  await screen.findByLabelText('One-use recovery codes');expect(signIn).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'I saved my recovery codes'}));expect(signIn).toHaveBeenCalledWith(expect.stringContaining('MFA is enabled'));
});
it('does not discard the operator session when the supplied current password is wrong',async()=>{
  vi.mocked(accessApi.beginOperatorMfa).mockRejectedValue(new AccessError(403,'CURRENT_PASSWORD_INVALID'));
  render(<OperatorMfaForm disabled={false} onSignInRequired={signIn}/>);await screen.findByText('Set up an authenticator');
  enter('Current password for authenticator changes','wrong');fireEvent.click(screen.getByRole('button',{name:'Create setup key',hidden:true}));
  await screen.findByRole('alert');expect(signIn).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Current password for authenticator changes')).toHaveValue('');
});
it('does not expose enrollment when the dedicated encryption key is unavailable',async()=>{
  vi.mocked(accessApi.operatorMfa).mockResolvedValue({configured:false,enabled:false});
  render(<OperatorMfaForm disabled={false} onSignInRequired={signIn}/>);
  await screen.findByText(/must configure the protected MFA encryption key/);
  expect(screen.queryByText('Set up an authenticator')).not.toBeInTheDocument();expect(accessApi.beginOperatorMfa).not.toHaveBeenCalled();
});
