package com.ax.rms.security;

import com.ax.rms.domain.Role;
import java.io.Serial;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import org.springframework.security.core.CredentialsContainer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

/**
 * 로그인한 계정(D16). 세션에 남는 값이므로 비밀번호 해시는 인증이 끝나면 지운다. 역할은 {@code ROLE_<역할>} 권한이 된다
 * (D17 겸임이면 여러 개).
 */
public final class AccountPrincipal implements UserDetails, CredentialsContainer {

  @Serial private static final long serialVersionUID = 1L;

  private final long accountId;
  private final long employeeId;
  private final String employeeName;
  private final String username;
  private final Set<Role> roles;
  private String passwordHash;

  /** 계정·직원·역할 값으로 만든다. */
  public AccountPrincipal(
      long accountId,
      long employeeId,
      String employeeName,
      String username,
      String passwordHash,
      Set<Role> roles) {
    this.accountId = accountId;
    this.employeeId = employeeId;
    this.employeeName = employeeName;
    this.username = username;
    this.passwordHash = passwordHash;
    this.roles = roles.isEmpty() ? EnumSet.noneOf(Role.class) : EnumSet.copyOf(roles);
  }

  /** 계정 ID. */
  public long accountId() {
    return accountId;
  }

  /** 이 계정과 1:1로 연결된 직원의 ID(D17). */
  public long employeeId() {
    return employeeId;
  }

  /** 이 계정과 연결된 직원의 이름. */
  public String employeeName() {
    return employeeName;
  }

  /** 이 계정의 역할. */
  public Set<Role> roles() {
    return EnumSet.copyOf(roles);
  }

  @Override
  public Collection<? extends GrantedAuthority> getAuthorities() {
    List<GrantedAuthority> authorities =
        roles.stream()
            .map(role -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + role.name()))
            .toList();
    return authorities;
  }

  @Override
  public String getPassword() {
    return passwordHash;
  }

  @Override
  public String getUsername() {
    return username;
  }

  @Override
  public void eraseCredentials() {
    passwordHash = null;
  }
}
