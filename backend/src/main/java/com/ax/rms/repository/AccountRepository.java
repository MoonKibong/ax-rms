package com.ax.rms.repository;

import com.ax.rms.domain.Account;
import com.ax.rms.domain.Role;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/** 계정과 역할 저장소. */
public interface AccountRepository {

  /** 계정을 저장하고, 생성된 id가 채워진 값을 돌려준다. */
  Account insert(Account account);

  /** 그 계정에 역할을 하나 더한다. */
  void assignRole(long accountId, Role role);

  /** 그 계정이 가진 역할 전체를 돌려준다. */
  Set<Role> findRoles(long accountId);

  /** 아이디로 계정을 찾는다. */
  Optional<Account> findByUsername(String username);

  /** 전체 계정을 돌려준다. */
  List<Account> findAll();

  /** 저장된 계정 수를 돌려준다. */
  long count();
}
