#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'jiva.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc

    # runserver без базы данных: сервер должен подняться, чтобы показать страницу ошибки БД
    if len(sys.argv) > 1 and sys.argv[1] == 'runserver' and '--skip-checks' not in sys.argv:
        sys.argv.append('--skip-checks')

    if len(sys.argv) > 1 and sys.argv[1] == 'runserver':
        from django.core.management.commands.runserver import Command as RunserverCommand

        if not getattr(RunserverCommand, '_db_safe_check', False):
            RunserverCommand._db_safe_check = True
            original_check_migrations = RunserverCommand.check_migrations

            def check_migrations(self, *args, **kwargs):
                try:
                    return original_check_migrations(self, *args, **kwargs)
                except Exception:
                    self.stdout.write('База данных недоступна: сервер запущен в режиме страницы ошибки БД.')

            RunserverCommand.check_migrations = check_migrations

    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
