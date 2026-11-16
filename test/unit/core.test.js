'use strict';
const { normalizeTitle, validateTicketInput, canChangeStatus, filterAndSort } = require('../../src/core');

describe('Базовые unit-тесты (дополните своими)', () => {
  test('удаляет пробелы в начале и конце темы', () => {
    expect(normalizeTitle('  Ошибка принтера  ')).toBe('Ошибка принтера');
  });

    // нормализация строки
  test.each([
    ['   ', '', 'строка только из пробелов пустая'],
  ])('normalizeTitle(%p) === %p - %s', (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected);
  });

  test('отклоняет неизвестную категорию', () => {
    const errors = validateTicketInput({
      title: 'Ошибка печати', description: 'Принтер не печатает документ',
      category: 'unknown', priority: 'low'
    });
    expect(errors).toHaveProperty('category');
  });

  test('запрещает возвращение из закрытого статуса', () => {
    expect(canChangeStatus('resolved', 'new')).toBe(false);
  });

  // Добавьте самостоятельные проверки границ, переходов и сортировки.
  // Нормализация строки 10 до 500 символов после удаления начальных пробелов//
  test.each([
    ['q'.repeat(9), false, 'меньше нижней границы'],
    ['q'.repeat(10), true, 'нижняя граница'],
    ['q'.repeat(376), true, 'выше нижней'],
    ['q'.repeat(500), true, 'верхняя граница'],
    ['q'.repeat(502), false, 'больше верхней границы'],
    ['    qw    ', false, 'после нормализации меньше нижней границы'],
    ['     qwertyuiop   ', true, 'после нормализации ровно нижняя граница'],
    ['  ' + 'q'.repeat(499) + '  ', true, 'корректно'],
    ['  ' + 'q'.repeat(501) + '  ', false, 'некорректно'],
  ])('тема %j в диапазоне от 10 до 500: %p (%s)', (title, expected, _why) => {
    const len = normalizeTitle(title).length;
    expect(len >= 10 && len <= 500).toBe(expected);
  });

  test('нормализация: убрать пробелы по краям описания', () => {
    expect(normalizeTitle('  Ошибка принтера  ')).toBe('Ошибка принтера');
  });

  // переходные состояния

  test.each([
    ['new', 'in_progress', true, 'new -> in_progress разрешен'],
    ['in_progress', 'resolved', true, 'in_progress -> resolved разрешен'],
    ['new', 'resolved', false, 'new -> resolved запрещен'],
    ['in_progress', 'new', false, 'in_progress -> new запрещен'],
    ['resolved', 'new', false, 'resolved -> new запрещен'],
    ['resolved', 'in_progress', false, 'resolved -> in_progress возврат запрещен'],
  ])('%p → %p = %p (%s)', (from, to, expected, _why) => {
    expect(canChangeStatus(from, to)).toBe(expected);
  });

  //сортировка по приоритету

  const order = (l, m, h) => filterAndSort([
      {id: 'l', priority: 'low', createdAt: 5},
      {id: 'm', priority: 'medium', createdAt: 5},
      {id: 'h', priority: 'high', createdAt: 5},
  ]).map(t => t.id);

  test('high раньше medium', () => {
    expect(order('high', 'medium')).toEqual(['high', 'medium']);
  });

  test('medium раньше low', () => {
    expect(order('medium', 'low')).toEqual(['medium', 'low']);
  });

  test('high раньше low', () => {
    expect(order('high', 'low')).toEqual(['high', 'low']);
  });

  //сортировка по приоритету и времени

  test('low', () => {
    const tickets = [
      {id: 'l', priority: 'low', createdAt: 1},
      {id: 'l2', priority: 'low', createdAt: 2},
      {id: 'l3', priority: 'low', createdAt: 3},
    ];
    expect(filterAndSort(tickets).map(t => t.id)).toEqual(['l', 'l2', 'l3']);
  });

//дефект 1
  test('high - medium - low', () => {
    const tickets = [
      { id: 1, priority: 'low', createdAt: '2026-01-01' },
      { id: 2, priority: 'high', createdAt: '2026-01-01' },
      { id: 3, priority: 'medium', createdAt: '2026-01-01' }
    ];

    expect(filterAndSort(tickets).map(t => t.priority))
      .toEqual(['high', 'medium', 'low']);
  });

//дефект 2
  test('сохраняет заявку с темой короче 5 символов после trim', () => {
    const errors = validateTicketInput({
      title: '    abc',
      description: 'Достаточно длинное описание заявки',
      category: 'network',
      priority: 'high'
    });

    expect(errors).not.toHaveProperty('title');
  });

});
