package com.ax.rms.security;

import com.ax.rms.domain.Account;
import com.ax.rms.domain.Employee;
import com.ax.rms.repository.AccountRepository;
import com.ax.rms.repository.EmployeeRepository;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/** 로그인할 때 아이디로 계정·직원·역할을 읽어 {@link AccountPrincipal}을 만든다. */
@Service
public class AccountUserDetailsService implements UserDetailsService {

  private final AccountRepository accountRepository;
  private final EmployeeRepository employeeRepository;

  /** 주어진 저장소로 만든다. */
  public AccountUserDetailsService(
      AccountRepository accountRepository, EmployeeRepository employeeRepository) {
    this.accountRepository = accountRepository;
    this.employeeRepository = employeeRepository;
  }

  @Override
  public AccountPrincipal loadUserByUsername(String username) {
    Account account =
        accountRepository
            .findByUsername(username)
            .orElseThrow(() -> new UsernameNotFoundException("계정이 없다"));
    Employee employee =
        employeeRepository
            .findById(account.employeeId())
            .orElseThrow(() -> new UsernameNotFoundException("계정의 직원이 없다"));
    return new AccountPrincipal(
        account.id(),
        account.employeeId(),
        employee.name(),
        account.username(),
        account.passwordHash(),
        accountRepository.findRoles(account.id()));
  }
}
