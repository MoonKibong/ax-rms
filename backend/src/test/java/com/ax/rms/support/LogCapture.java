package com.ax.rms.support;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.List;
import org.slf4j.LoggerFactory;

/** 루트 로거의 로그 이벤트를 모아 두었다가 검사가 읽게 한다. {@link #close()}로 떼어 낸다. */
public final class LogCapture implements AutoCloseable {

  private final Logger root = (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
  private final ListAppender<ILoggingEvent> appender = new ListAppender<>();

  /** 모으기를 시작한다. */
  public LogCapture() {
    appender.start();
    root.addAppender(appender);
  }

  /** 지금까지 모은 이벤트 중 그 수준 이상인 것을 돌려준다. */
  public List<ILoggingEvent> atLeast(Level level) {
    return appender.list.stream().filter(e -> e.getLevel().isGreaterOrEqual(level)).toList();
  }

  /** 지금까지 모은 이벤트 중 그 수준 정확히인 것을 돌려준다. */
  public List<ILoggingEvent> exactly(Level level) {
    return appender.list.stream().filter(e -> e.getLevel().equals(level)).toList();
  }

  @Override
  public void close() {
    root.detachAppender(appender);
    appender.stop();
  }
}
