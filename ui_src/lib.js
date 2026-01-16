import { h, Component, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import apiFetch from './api-fetch';
import debug from 'debug';

const html = htm.bind(h);

window.hsyncConfig.libs = {
  preact: {
    h,
    Component,
    render,
    useState,
    useEffect,
    html,
  },
  htm,
  apiFetch,
  debug,
};
