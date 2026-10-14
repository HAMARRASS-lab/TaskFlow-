package com.taskflow.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserTokenRepository extends JpaRepository<UserToken, Long> {

    @Query("select t from UserToken t join fetch t.user where t.tokenHash = :hash and t.purpose = :purpose")
    Optional<UserToken> findByHash(@Param("hash") String hash, @Param("purpose") TokenPurpose purpose);

    /** Invalidates older links of the same kind when a new one is sent. */
    @Modifying
    @Query("delete from UserToken t where t.user.id = :userId and t.purpose = :purpose")
    void deleteByUserAndPurpose(@Param("userId") Long userId, @Param("purpose") TokenPurpose purpose);
}
